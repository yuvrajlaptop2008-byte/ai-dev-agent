// Seed catalog - refreshed live at runtime via refreshModels()
const PAID_MODELS = {
  'anthropic/claude-3.5-sonnet':'Claude 3.5 Sonnet','anthropic/claude-3-opus':'Claude 3 Opus',
  'anthropic/claude-3-haiku':'Claude 3 Haiku','anthropic/claude-3.7-sonnet':'Claude 3.7 Sonnet',
  'openai/gpt-4o':'GPT-4o','openai/gpt-4o-mini':'GPT-4o Mini','openai/gpt-4-turbo':'GPT-4 Turbo',
  'openai/o1':'o1','openai/o1-mini':'o1-mini','openai/o1-preview':'o1-preview','openai/o3-mini':'o3-mini',
  'google/gemini-pro-1.5':'Gemini Pro 1.5','google/gemini-2.0-flash-001':'Gemini 2.0 Flash',
  'google/gemini-2.5-pro-preview':'Gemini 2.5 Pro','google/gemini-flash-1.5':'Gemini Flash 1.5',
  'mistralai/mistral-large':'Mistral Large','mistralai/codestral-latest':'Codestral',
  'mistralai/mixtral-8x22b-instruct':'Mixtral 8x22B','deepseek/deepseek-chat':'DeepSeek Chat',
  'deepseek/deepseek-coder':'DeepSeek Coder','deepseek/deepseek-r1':'DeepSeek R1 (paid)',
  'x-ai/grok-2':'Grok 2','x-ai/grok-beta':'Grok Beta','meta-llama/llama-3.1-405b-instruct':'Llama 3.1 405B',
  'meta-llama/llama-3.3-70b-instruct':'Llama 3.3 70B','qwen/qwen-2.5-72b-instruct':'Qwen 2.5 72B',
  'qwen/qwen-2.5-coder-32b-instruct':'Qwen 2.5 Coder 32B','cohere/command-r-plus':'Command R+',
  'perplexity/llama-3.1-sonar-large-128k-online':'Perplexity Sonar Large (web-connected)'
};

const FREE_MODELS = [
  "meta-llama/llama-3.1-8b-instruct:free","meta-llama/llama-3.2-3b-instruct:free","meta-llama/llama-3.2-11b-vision-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free","meta-llama/llama-4-scout:free","meta-llama/llama-4-maverick:free",
  "google/gemma-2-9b-it:free","google/gemma-3-4b-it:free","google/gemma-3-12b-it:free","google/gemma-3-27b-it:free",
  "google/gemini-2.0-flash-exp:free","google/gemini-2.5-pro-exp-03-25:free",
  "mistralai/mistral-7b-instruct:free","mistralai/mistral-small-3.1-24b-instruct:free","mistralai/devstral-small-2505:free",
  "microsoft/phi-3-mini-128k-instruct:free","microsoft/phi-4:free","microsoft/phi-4-reasoning:free",
  "deepseek/deepseek-r1:free","deepseek/deepseek-r1-zero:free","deepseek/deepseek-chat-v3-0324:free","deepseek/deepseek-prover-v2:free",
  "qwen/qwen-2.5-72b-instruct:free","qwen/qwen-2.5-coder-32b-instruct:free","qwen/qwen3-235b-a22b:free","qwen/qwen3-32b:free","qwen/qwq-32b:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free","nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
  "thudm/glm-4-32b:free","nousresearch/hermes-3-llama-3.1-8b:free","agentica-org/deepcoder-14b-preview:free",
  "tngtech/deepseek-r1t-chimera:free","rekaai/reka-flash-3:free","moonshotai/kimi-vl-a3b-thinking:free"
];

module.exports = { PAID_MODELS, FREE_MODELS };
