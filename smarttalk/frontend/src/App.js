import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { okaidia } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Play,
  Send,
  RefreshCw,
  ChevronRight,
  Plus,
  Trash2,
  Flag
} from 'lucide-react';

const API_URL = 'http://localhost:8000';

// Define Monokai dark theme for Monaco editor
const handleEditorWillMount = (monaco) => {
  monaco.editor.defineTheme('monokai-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '75715E', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'F92672' },
      { token: 'string', foreground: 'E6DB74' },
      { token: 'number', foreground: 'AE81FF' },
      { token: 'type', foreground: '66D9EF', fontStyle: 'italic' },
      { token: 'class', foreground: 'A6E22E' },
      { token: 'function', foreground: 'A6E22E' },
      { token: 'variable', foreground: 'F8F8F2' },
      { token: 'operator', foreground: 'F92672' },
      { token: 'delimiter', foreground: 'F8F8F2' },
      { token: 'constant', foreground: 'AE81FF' },
      { token: 'decorator', foreground: 'F92672' },
    ],
    colors: {
      'editor.background': '#272822',
      'editor.foreground': '#F8F8F2',
      'editor.lineHighlightBackground': '#3E3D32',
      'editor.selectionBackground': '#49483E',
      'editorCursor.foreground': '#F8F8F0',
      'editorWhitespace.foreground': '#3B3A32',
      'editorLineNumber.foreground': '#90908A',
      'editorLineNumber.activeForeground': '#F8F8F2',
      'editor.selectionHighlightBackground': '#49483E88',
      'editorIndentGuide.background': '#3B3A32',
      'editorIndentGuide.activeBackground': '#767771',
      'editorWidget.background': '#1E1F1C',
      'editorSuggestWidget.background': '#272822',
      'editorSuggestWidget.border': '#75715E',
      'scrollbarSlider.background': '#49483E80',
      'scrollbarSlider.hoverBackground': '#49483EA0',
      'scrollbarSlider.activeBackground': '#49483ECC',
    },
  });
};

// Helper to get starter code
const getStarterCode = (funcSignature, classDefs) => {
  let code = '';
  if (classDefs && classDefs.trim()) {
    code += classDefs.trim() + '\n\n';
  }
  code += (funcSignature || 'def solve():') + '\n    pass';
  return code;
};

/**
 * Format problem text so that Examples, Input, Output, and Explanation
 * each start on their own line with clear visual breaks.
 */
const formatProblemExamples = (text) => {
  if (!text) return text;

  // Ensure **Example N:** always starts on a new line with a blank line before it
  text = text.replace(/([^\n])\s*(\*\*Example\s*\d+)/g, '$1\n\n$2');

  // Ensure Input: / Output: / Explanation: each start on their own line
  // Handle both bold and non-bold variants
  text = text.replace(/([^\n])\s*(\*?\*?Input\*?\*?\s*:)/g, '$1\n$2');
  text = text.replace(/([^\n])\s*(\*?\*?Output\*?\*?\s*:)/g, '$1\n$2');
  text = text.replace(/([^\n])\s*(\*?\*?Explanation\*?\*?\s*:)/g, '$1\n$2');

  // Ensure **Constraints:** gets a blank line before it
  text = text.replace(/([^\n])\s*(\*\*Constraints?\*?\*?\s*:)/g, '$1\n\n$2');

  // Clean up triple+ newlines to just double
  text = text.replace(/\n{3,}/g, '\n\n');

  return text;
};

// Sanitize broken markdown from LLM responses before rendering
const sanitizeMarkdown = (text) => {
  if (!text) return text;

  // Fix inline code followed by stray triple backticks: `foo` ``` bar -> `foo` bar
  text = text.replace(/(`[^`\n]+`)\s*```\s*/g, '$1 ');

  // Remove stray ``` that appear mid-line (not at line start, not inside code blocks)
  const lines = text.split('\n');
  const cleaned = [];
  let inCodeBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
        cleaned.push(line);
      } else if (trimmed === '```') {
        // Check if there's a matching close
        const remaining = lines.slice(cleaned.length + 1).join('\n');
        if (remaining.includes('```')) {
          inCodeBlock = true;
          cleaned.push(line);
        }
        // else orphan, skip
      } else {
        inCodeBlock = true;
        cleaned.push(line);
      }
    } else if (!inCodeBlock && line.includes('```')) {
      // Remove stray triple backticks mid-line
      cleaned.push(line.replace(/```\s*/g, ''));
    } else {
      cleaned.push(line);
    }
  }
  return cleaned.join('\n');
};

// Markdown renderer component with code highlighting
const MarkdownRenderer = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={okaidia}
              language={match[1]}
              PreTag="div"
              customStyle={{
                borderRadius: '0.5rem',
                padding: '1rem',
                maxWidth: '100%',
                overflowX: 'auto',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-sm font-mono break-all" {...props}>
              {children}
            </code>
          );
        },
        // Give paragraphs containing Example/Input/Output/Explanation better spacing
        p({ children, ...props }) {
          const text = typeof children === 'string' ? children : '';
          const isExample = /^Example\s*\d+/.test(text) ||
            (Array.isArray(children) && children.some(c =>
              typeof c === 'object' && c?.props?.children &&
              /^Example\s*\d+/.test(String(c.props.children))
            ));

          return (
            <p
              className={isExample ? 'mt-5 mb-1 font-semibold text-blue-700' : 'mb-2'}
              {...props}
            >
              {children}
            </p>
          );
        }
      }}
    >
      {sanitizeMarkdown(content)}
    </ReactMarkdown>
  );
};

// Quiz Progress Component
const QuizProgress = ({ submitted, scores, gaveUp }) => {
  const difficulties = ['Easy', 'Medium', 'Hard', 'Expert'];
  const completed = Object.values(submitted).filter(Boolean).length;
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-gray-700 mb-3">Quiz Progress</h3>
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span>Progress</span>
          <span>{completed}/4</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(completed / 4) * 100}%` }} />
        </div>
      </div>
      {difficulties.map((diff, i) => (
        <div key={diff} className="flex justify-between text-sm py-1">
          <span>
            {submitted[i] ? (gaveUp[i] ? 'Gave up' : 'Done') : 'Pending'} - {diff}
          </span>
          <span>
            {submitted[i]
              ? gaveUp[i]
                ? '0/10 (gave up)'
                : `${scores[i] || 0}/10`
              : 'Pending'}
          </span>
        </div>
      ))}
    </div>
  );
};

// Test Case Component
const TestCases = ({ testCases, onAdd, onDelete, onRun, canRun, results }) => {
  const [input, setInput] = useState('');
  const [expected, setExpected] = useState('');
  const handleAdd = () => {
    if (input.trim()) {
      onAdd({ input: input.trim(), expected: expected.trim() });
      setInput(''); setExpected('');
    }
  };
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-gray-700 mb-3">Test Cases</h3>
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <input type="text" placeholder='Input: [1, 2]' value={input} onChange={(e) => setInput(e.target.value)} className="w-full p-2 border rounded mb-2 text-sm font-mono" />
        <input type="text" placeholder="Expected output" value={expected} onChange={(e) => setExpected(e.target.value)} className="w-full p-2 border rounded mb-2 text-sm font-mono" />
        <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded text-sm"><Plus size={14} /> Add</button>
      </div>
      <div className="space-y-2 mb-4">
        {testCases.map((tc, i) => (
          <div key={i} className="flex justify-between p-2 bg-gray-50 rounded text-xs font-mono">
            <div>In: {tc.input} {results?.[i] && (results[i].status === 'passed' ? 'PASS' : 'FAIL')}</div>
            <button onClick={() => onDelete(i)} className="text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button onClick={onRun} disabled={!canRun || testCases.length === 0} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300">
        <Play size={16} /> Run Tests
      </button>
    </div>
  );
};

// Final Results Component
const FinalResults = ({ scores, gaveUp, onRestart }) => {
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const difficulties = ['Easy', 'Medium', 'Hard', 'Expert'];
  const gaveUpCount = Object.values(gaveUp).filter(Boolean).length;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8 text-center">
      <h1 className="text-3xl font-bold mb-6">Quiz Complete!</h1>
      <div className="text-6xl mb-4"></div>
      <div className="text-4xl font-bold mb-2">{totalScore}/40</div>
      {gaveUpCount > 0 && (
        <p className="text-sm text-gray-500 mb-4">
          Gave up on {gaveUpCount} problem{gaveUpCount > 1 ? 's' : ''}
        </p>
      )}
      <div className="text-left max-w-xs mx-auto mb-6 space-y-1">
        {difficulties.map((diff, i) => (
          <div key={diff} className="flex justify-between text-sm">
            <span>{gaveUp[i] ? 'Gave up' : 'Done'} - {diff}</span>
            <span className={gaveUp[i] ? 'text-gray-400' : ''}>{scores[i] || 0}/10</span>
          </div>
        ))}
      </div>
      <button onClick={onRestart} className="px-6 py-3 bg-blue-500 text-white rounded-lg flex items-center gap-2 mx-auto hover:bg-blue-600">
        <RefreshCw size={20} /> New Quiz
      </button>
    </div>
  );
};

// Give Up Confirmation Modal
const GiveUpModal = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
      <h3 className="text-lg font-bold mb-2">Give Up?</h3>
      <p className="text-gray-600 mb-4">
        You'll receive a score of 0 for this problem, but you'll get to see the full solution with an explanation.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Keep Trying
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Give Up
        </button>
      </div>
    </div>
  </div>
);

function App() {
  const [quizStarted, setQuizStarted] = useState(false);
  const [problems, setProblems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState({});
  const [scores, setScores] = useState({});
  const [feedback, setFeedback] = useState({});
  const [gaveUp, setGaveUp] = useState({});
  const [testCases, setTestCases] = useState({});
  const [testResults, setTestResults] = useState({});
  const [poolStatus, setPoolStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [givingUp, setGivingUp] = useState(false);
  const [showGiveUpModal, setShowGiveUpModal] = useState(false);

  const difficulties = ['Easy', 'Medium', 'Hard', 'Expert'];

  const fetchPoolStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/pool/status`);
      setPoolStatus(response.data);
    } catch (error) {
      console.error('Backend unreachable. Ensure Python server is running on port 8000.');
    }
  }, []);

  useEffect(() => {
    fetchPoolStatus();
    const interval = setInterval(fetchPoolStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchPoolStatus]);

  const startQuiz = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/quiz/start`);
      const probs = response.data.problems;
      setProblems(probs);
      const initialAnswers = {};
      probs.forEach((p, i) => {
        initialAnswers[i] = getStarterCode(p.func_signature, p.class_definitions);
      });
      setAnswers(initialAnswers);
      setSubmitted({});
      setScores({});
      setFeedback({});
      setGaveUp({});
      setTestCases({});
      setTestResults({});
      setCurrentIndex(0);
      setQuizStarted(true);
    } catch (error) {
      alert('Failed to start quiz. Are 4 problems generated yet?');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (value) => setAnswers(prev => ({ ...prev, [currentIndex]: value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await axios.post(`${API_URL}/quiz/submit`, {
        code: answers[currentIndex],
        problem_index: currentIndex,
        problem: problems[currentIndex].problem,
        func_signature: problems[currentIndex].func_signature
      });
      setScores(prev => ({ ...prev, [currentIndex]: response.data.score }));
      setFeedback(prev => ({ ...prev, [currentIndex]: response.data.feedback }));
      setSubmitted(prev => ({ ...prev, [currentIndex]: true }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGiveUp = async () => {
    setShowGiveUpModal(false);
    setGivingUp(true);
    try {
      const response = await axios.post(`${API_URL}/quiz/give-up`, {
        code: answers[currentIndex],
        problem_index: currentIndex,
        problem: problems[currentIndex].problem,
        func_signature: problems[currentIndex].func_signature
      });
      setScores(prev => ({ ...prev, [currentIndex]: 0 }));
      setFeedback(prev => ({ ...prev, [currentIndex]: response.data.feedback }));
      setSubmitted(prev => ({ ...prev, [currentIndex]: true }));
      setGaveUp(prev => ({ ...prev, [currentIndex]: true }));
    } catch (error) {
      console.error('ERROR', error);
      console.error('Error details:', error.response?.data);
      alert(`Failed to generate solution: ${error.response?.data?.detail || error.message}`);
    } finally {
      setGivingUp(false);
    }
  };

  const allDone = Object.keys(submitted).length === 4;

  if (allDone) {
    return (
      <div className="p-8 dark-dynamic-bg min-h-screen">
        <FinalResults scores={scores} gaveUp={gaveUp} onRestart={() => window.location.reload()} />
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="min-h-screen dark-dynamic-bg flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-6 text-center">SmartTalk</h1>
          <div className="space-y-4 mb-8 text-gray-600">
            <p>• 4 Coding Problems (Easy to Expert)</p>
            <p>• Scored out of 40 points total</p>
            <p>• AI-powered feedback & grading</p>
          </div>
          <button
            onClick={startQuiz}
            disabled={!poolStatus?.ready || loading}
            className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-colors ${
              poolStatus?.ready && !loading ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500'
            }`}
          >
            {loading ? <RefreshCw className="animate-spin" /> : 'Start Quiz'}
          </button>
          {!poolStatus?.ready && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">Waiting for problems to generate...</p>
              <p className="text-xs font-mono text-blue-500 mt-1">Ready: {poolStatus?.total || 0} / 4</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentProblem = problems[currentIndex];

  return (
    <div className="min-h-screen dark-dynamic-bg">
      {showGiveUpModal && (
        <GiveUpModal
          onConfirm={handleGiveUp}
          onCancel={() => setShowGiveUpModal(false)}
        />
      )}

      <header className="bg-white shadow px-4 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">Quiz Mode</h1>
            <span className="text-sm font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
              {difficulties[currentIndex]}
            </span>
          </div>
          <div className="flex gap-2">
            {difficulties.map((diff, i) => (
              <button key={diff} onClick={() => setCurrentIndex(i)} className={`flex-1 py-2 rounded text-sm font-medium ${
                currentIndex === i
                  ? 'bg-blue-600 text-white'
                  : submitted[i]
                    ? gaveUp[i]
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-green-100 text-green-700'
                    : 'bg-white border'
              }`}>
                {submitted[i] ? (gaveUp[i] ? 'X' : 'Done') : i + 1}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Problem description with formatted examples */}
          <div className="bg-white rounded-lg shadow p-6 prose prose-sm max-w-none break-words overflow-hidden">
            <MarkdownRenderer content={formatProblemExamples(currentProblem?.problem)} />
          </div>

          {/* Code editor */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Editor
              height="400px"
              language="python"
              theme="monokai-dark"
              beforeMount={handleEditorWillMount}
              value={answers[currentIndex]}
              onChange={handleCodeChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                smoothScrolling: true,
                mouseWheelScrollSensitivity: 0.5,
                cursorSmoothCaretAnimation: 'on',
                cursorBlinking: 'smooth',
                scrollBeyondLastLine: true,
                padding: { top: 16, bottom: 16 },
                lineHeight: 24,
                fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
                readOnly: submitted[currentIndex] || false,
              }}
            />
          </div>

          {/* Feedback section */}
          {feedback[currentIndex] && (
            <div className={`border-l-4 p-6 rounded shadow overflow-hidden ${
              gaveUp[currentIndex]
                ? 'bg-orange-50 border-orange-400'
                : 'bg-blue-50 border-blue-500'
            }`}>
              <h3 className="font-bold mb-2">
                {gaveUp[currentIndex] ? 'Solution & Explanation' : 'AI Feedback'}
              </h3>
              <div className="prose prose-sm max-w-none break-words overflow-x-auto">
                <MarkdownRenderer content={feedback[currentIndex]} />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-4">
            {!submitted[currentIndex] && (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || givingUp}
                  className="flex-1 py-4 bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  {submitting ? <RefreshCw className="animate-spin" size={20} /> : <><Send size={20} /> Submit Solution</>}
                </button>
                <button
                  onClick={() => setShowGiveUpModal(true)}
                  disabled={submitting || givingUp}
                  className="py-4 px-6 bg-white border-2 border-red-300 text-red-500 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-50 hover:border-red-400 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400 transition-colors"
                >
                  {givingUp ? <RefreshCw className="animate-spin" size={20} /> : <><Flag size={20} /> Give Up</>}
                </button>
              </>
            )}
            {submitted[currentIndex] && currentIndex < 3 && (
              <button
                onClick={() => {
                  const next = difficulties.findIndex((_, i) => i > currentIndex && !submitted[i]);
                  if (next !== -1) setCurrentIndex(next);
                  else setCurrentIndex(currentIndex + 1);
                }}
                className="flex-1 py-4 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <ChevronRight size={20} /> Next Problem
              </button>
            )}
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-4 space-y-6">
          <QuizProgress submitted={submitted} scores={scores} gaveUp={gaveUp} />
          <TestCases
            testCases={testCases[currentIndex] || []}
            onAdd={(tc) => setTestCases(prev => ({ ...prev, [currentIndex]: [...(prev[currentIndex] || []), tc] }))}
            onDelete={(idx) => setTestCases(prev => ({ ...prev, [currentIndex]: prev[currentIndex].filter((_, i) => i !== idx) }))}
            onRun={async () => {
              const res = await axios.post(`${API_URL}/quiz/run-tests`, { code: answers[currentIndex], func_signature: currentProblem.func_signature, test_cases: testCases[currentIndex] });
              setTestResults(prev => ({ ...prev, [currentIndex]: res.data.results }));
            }}
            canRun={!!answers[currentIndex] && !submitted[currentIndex]}
            results={testResults[currentIndex]}
          />
        </aside>
      </main>
    </div>
  );
}

export default App;