// api/ai-hint.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const MAX_ATTEMPTS = 10;

// Helper function to call OpenRouter API
async function callOpenRouter(prompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Helper function to call Google Gemini API
async function callGemini(prompt) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

export default async function handler(req, res) {
  // CORS headers - simple approach matching DF_7 for reliability
  res.setHeader('Access-Control-Allow-Origin', 'https://shir-openu.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userInput, currentStep, problemData, conversationHistory } = req.body;

  // Check attempt limit
  if (conversationHistory && conversationHistory.length >= MAX_ATTEMPTS) {
    return res.status(200).json({
      hint: `You have used all ${MAX_ATTEMPTS} attempts. Here is the full solution:\n\n` + problemData.fullSolution
    });
  }

  try {
    // Determine which AI provider to use
    const aiProvider = process.env.AI_PROVIDER || 'google';

    // Build conversation history text
    let conversationText = '';
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach(turn => {
        conversationText += `Student answer: ${turn.user}\nTeacher response: ${turn.ai}\n\n`;
      });
    }

const prompt = `
# CRITICAL INSTRUCTIONS
1. Respond in ENGLISH only
2. Be PRACTICAL and SPECIFIC - give concrete mathematical guidance
3. Keep responses 2-4 sentences
4. Use gender-neutral language (plural forms)
5. NEVER give the complete final answer until ${MAX_ATTEMPTS} attempts exhausted
6. NEVER repeat the same hint - check conversation history and progress
7. NEVER put quotes around equations - write them directly without '' or "" marks
8. ACCEPT ANY MATHEMATICALLY EQUIVALENT FORM of the correct answer

---

# The Exercise: 2×2 ODE System with Complex Eigenvalues

## The Problem:
x' = Ax, x(0) = [1, 0]^T
A = [3, -2; 4, -1]

Find the solution without using complex numbers.

## COMPLETE SOLUTIONS (your reference):

**Step 1 - Find Eigenvalues:**
- Characteristic polynomial: |λI - A| = (λ-3)(λ+1) - (-2)(4) = λ² - 2λ + 5
- Using quadratic formula: λ = (2 ± √(4-20))/2 = (2 ± √(-16))/2 = (2 ± 4i)/2
- ANSWER: λ = 1 ± 2i (α = 1, β = 2)

**Step 2 - Find Eigenvector for λ = 1 + 2i:**
- (λI - A)v = 0
- [(-2+2i), 2; -4, (2+2i)][v₁; v₂] = 0
- From first equation: (-2+2i)v₁ + 2v₂ = 0
- v₂ = (2-2i)v₁/2 = (1-i)v₁
- Choose v₁ = 1: ANSWER: v = [1, 1-i]^T

**Step 3 - General Solution:**
- Complex solution: e^{(1+2i)t}v = e^t·e^{2it}[1; 1-i]
- Using Euler: e^{2it} = cos2t + i·sin2t
- Real part: x₁(t) = e^t[cos2t; cos2t + sin2t]
- Imaginary part: x₂(t) = e^t[sin2t; sin2t - cos2t]
- ANSWER: x(t) = C₁e^t[cos2t; cos2t+sin2t] + C₂e^t[sin2t; sin2t-cos2t]

**Step 4 - Apply Initial Conditions x(0) = [1, 0]^T:**
- At t=0: [1; 0] = C₁[1; 1] + C₂[0; -1]
- From first component: C₁ = 1
- From second component: C₁ - C₂ = 0 → C₂ = 1
- ANSWER: C₁ = 1, C₂ = 1
- FINAL: x(t) = e^t(cos2t + sin2t), y(t) = 2e^t·sin2t

---

## Current Step: ${currentStep}
## Expected Answer: ${problemData.correctAnswer}
## Student Input: ${userInput}

${conversationText ? `## Previous Conversation:\n${conversationText}` : ''}

---

# SPECIFIC HINTS BY STEP (give progressively):

## If Step 1 (eigenvalues):
- Hint 1: "Compute the characteristic polynomial |λI - A| = 0. The determinant is (λ-3)(λ+1) - (-2)(4)."
- Hint 2: "The polynomial is λ² - 2λ + 5 = 0. Use the quadratic formula."
- Hint 3: "The discriminant is 4 - 20 = -16, negative! Therefore the solutions are complex."
- Hint 4: "λ = (2 ± √(-16))/2 = (2 ± 4i)/2 = 1 ± 2i. The real part is α=1, imaginary part β=2."

## If Step 2 (eigenvector):
- Hint 1: "Substitute λ = 1+2i into the matrix (λI - A) and solve the system (λI - A)v = 0."
- Hint 2: "The first equation is (-2+2i)v₁ + 2v₂ = 0. Choose v₁ = 1 and find v₂."
- Hint 3: "From the equation: v₂ = -(−2+2i)/2 = (2-2i)/2 = 1-i"
- Hint 4: "The eigenvector is v = [1, 1-i]^T"

## If Step 3 (general solution):
- Hint 1: "Use Euler's formula: e^{iθ} = cosθ + i·sinθ"
- Hint 2: "The complex solution is e^{(1+2i)t}[1; 1-i] = e^t(cos2t + i·sin2t)[1; 1-i]"
- Hint 3: "Expand the product and separate into real and imaginary parts."
- Hint 4: "The real part gives one solution, the imaginary part gives the second solution."

## If Step 4 (initial conditions):
- Hint 1: "Substitute t=0 in the general solution. Remember: cos0=1, sin0=0"
- Hint 2: "You get [1; 0] = C₁[1; 1] + C₂[0; -1]"
- Hint 3: "From the first component: C₁ = 1. From the second component: C₁ - C₂ = 0"
- Hint 4: "Therefore C₂ = C₁ = 1"

# COMMON ERRORS TO CHECK:
- Wrong sign in characteristic polynomial
- Confusion between real and imaginary parts of eigenvector
- Forgetting to use Euler's formula correctly
- Mixing up C₁ and C₂ in initial conditions
- Wrong sign when splitting complex solution

# YOUR RESPONSE:
1. If CORRECT: "Correct! [brief confirmation]" and encourage next step
2. If INCORRECT: Identify the specific error and give the appropriate hint from above
3. If student asks for help/hint: Give the next hint in progression
4. After 3+ attempts: Give more explicit guidance, show intermediate steps
`;

    // Call the appropriate AI provider
    let hint;
    if (aiProvider === 'openrouter') {
      hint = await callOpenRouter(prompt);
    } else {
      // Default to Google Gemini
      hint = await callGemini(prompt);
    }

    return res.status(200).json({ hint, provider: aiProvider });

  } catch (error) {
    console.error('AI API Error:', error);
    const aiProvider = process.env.AI_PROVIDER || 'google';
    return res.status(500).json({
      error: 'Error processing request. Please try again.',
      provider: aiProvider,
      details: error.message
    });
  }
}
