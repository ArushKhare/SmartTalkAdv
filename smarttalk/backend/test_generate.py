#!/usr/bin/env python3
"""Test problem generation to see errors"""
import os
import sys
from dotenv import load_dotenv
from google import genai
import json
import re

load_dotenv()
API_KEY = os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=API_KEY)

prompt = """Generate a Easy coding interview problem.

Include:
1. Problem description (clear and concise)
2. Input format
3. Output format
4. 2-3 examples with input/output and explanation
5. Constraints (use LaTeX for mathematical expressions and inequalities)
6. Python function signature with type hints

IMPORTANT FORMATTING RULES:
- Use LaTeX notation for all mathematical expressions, inequalities, and complexity
- Inline math: $...$  (e.g., $1 \le n \le 10^5$, $O(n)$)
- Use proper LaTeX symbols: \le (≤), \ge (≥), \times, \sum, etc.
- Format constraints with LaTeX inequalities
- DO NOT use plain text <= or >= symbols - use LaTeX $\le$ and $\ge$

Example format for the problem field:
"Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.

Input: nums = array of integers, target = integer
Output: array of two indices

Example 1:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: nums[0] + nums[1] = 2 + 7 = 9

Example 2:
Input: nums = [3,2,4], target = 6
Output: [1,2]

Constraints:
- $2 \le \text{nums.length} \le 10^4$
- $-10^9 \le \text{nums}[i] \le 10^9$
- Expected time complexity: $O(n)$"

Rules:
- No imports needed (typing symbols like List, Dict, Optional exist)
- Make examples clear and varied
- Keep description under 300 words
- Function name should be descriptive
- ALWAYS use LaTeX for math expressions

Return ONLY valid JSON:
{"problem": "full problem description with examples", "func_signature": "def function_name(params: Type) -> ReturnType:", "class_definitions": ""}"""

try:
    print("Generating problem...")
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt
    )

    text = response.text.strip()
    print("Raw response:")
    print(text)
    print("\n" + "="*80 + "\n")

    # Try to parse JSON
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

    json_match = re.search(r'\{[^{}]*"problem"[^{}]*"func_signature"[^{}]*\}', text, re.DOTALL)
    if json_match:
        text = json_match.group(0)

    print("Extracted JSON:")
    print(text)
    print("\n" + "="*80 + "\n")

    # Fix LaTeX backslashes for JSON parsing
    latex_commands = ['le', 'ge', 'text', 'sum', 'prod', 'int', 'frac', 'sqrt', 'times', 'div', 'pm', 'mp', 'leq', 'geq', 'ne', 'approx', 'equiv', 'cdot', 'alpha', 'beta', 'gamma', 'delta', 'theta', 'lambda', 'mu', 'sigma', 'pi', 'omega']
    for cmd in latex_commands:
        text = text.replace(f'\\{cmd}', f'\\\\{cmd}')

    print("After escaping backslashes:")
    print(text)
    print("\n" + "="*80 + "\n")

    data = json.loads(text)
    print("Parsed successfully!")
    print(json.dumps(data, indent=2))

except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
