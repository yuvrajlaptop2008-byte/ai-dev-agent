const { chat } = require('./openrouter');
const { db } = require('../db');
const { v4: uuid } = require('uuid');
const tools = require('../tools');

const AGENT_SYSTEM = `You are an expert autonomous AI coding agent with these capabilities:
1. Solve GitHub issues end-to-end (read, analyze, code fix, PR creation)
2. Write, debug, refactor, and review code in any language
3. Research solutions using web search and documentation
4. Plan complex projects with step-by-step breakdowns
5. Execute bash commands, read/write files
6. Analyze codebases and suggest improvements
7. Create tests, documentation, CI/CD configs

When given a task:
- PLAN first: break into clear steps
- RESEARCH: find relevant code/docs
- EXECUTE: perform actions using tools
- VERIFY: check your work
- REPORT: summarize what you did

Use tools sequentially. Think step by step. Be autonomous but explain your reasoning.`;

async function runAgent(data, socket) {
  const { task, model, conversationId, repoOwner, repoName } = data;
  const runId = uuid();

  const insertRun = db.prepare('INSERT INTO agent_runs VALUES (?,?,?,?,?,unixepoch())');
  insertRun.run(runId, task, 'running', '[]', null);

  socket.emit('agent-start', { runId, task });

  const steps = [];
  const messages = [{ role: 'user', content: task }];

  const addStep = (step) => {
    steps.push(step);
    db.prepare('UPDATE agent_runs SET steps=? WHERE id=?').run(JSON.stringify(steps), runId);
    socket.emit('agent-step', step);
  };

  try {
    let iteration = 0;
    const maxIter = 10;

    while (iteration < maxIter) {
      iteration++;
      addStep({ type: 'thinking', content: `Iteration ${iteration}`, ts: Date.now() });

      const response = await chat(messages, model || 'anthropic/claude-3.5-sonnet', tools.getToolDefs(), AGENT_SYSTEM);
      const choice = response.choices[0];
      const msg = choice.message;

      messages.push(msg);

      if (msg.content) {
        addStep({ type: 'response', content: msg.content, ts: Date.now() });
      }

      if (choice.finish_reason === 'stop' || !msg.tool_calls?.length) {
        break;
      }

      // Execute tool calls
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        let args;
        try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }

        addStep({ type: 'tool_call', tool: toolName, args, ts: Date.now() });

        let result;
        try {
          result = await tools.execute(toolName, args, { repoOwner, repoName });
          addStep({ type: 'tool_result', tool: toolName, result: String(result).slice(0, 2000), ts: Date.now() });
        } catch (e) {
          result = `Error: ${e.message}`;
          addStep({ type: 'tool_error', tool: toolName, error: e.message, ts: Date.now() });
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: String(result)
        });
      }
    }

    const finalMsg = messages.filter(m => m.role === 'assistant' && m.content).pop();
    db.prepare('UPDATE agent_runs SET status=?,result=? WHERE id=?').run('done', finalMsg?.content || 'Completed', runId);
    socket.emit('agent-done', { runId, result: finalMsg?.content });

  } catch (e) {
    db.prepare('UPDATE agent_runs SET status=?,result=? WHERE id=?').run('error', e.message, runId);
    socket.emit('agent-error', { runId, error: e.message });
  }
}

module.exports = { runAgent };
