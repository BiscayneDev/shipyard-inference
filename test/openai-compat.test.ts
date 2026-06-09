import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  openAIRequestToChatParams,
  llmResponseToOpenAICompletion,
} from '../src/openai-compat/index.js'

test('openAIRequestToChatParams maps system/user/assistant/tool + tools', () => {
  const params = openAIRequestToChatParams({
    model: 'gpt-4o',
    max_tokens: 100,
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 't1', type: 'function', function: { name: 'f', arguments: '{"a":1}' } }],
      },
      { role: 'tool', tool_call_id: 't1', content: 'the result' },
    ],
    tools: [{ type: 'function', function: { name: 'f', description: 'd', parameters: { type: 'object' } } }],
  })

  assert.equal(params.system, 'sys')
  assert.equal(params.maxTokens, 100)
  assert.deepEqual(params.messages[0], { role: 'user', content: 'hi' })
  assert.equal(params.messages[1]?.role, 'assistant')
  assert.deepEqual(params.messages[1]?.toolCalls, [{ id: 't1', name: 'f', input: { a: 1 } }])
  assert.equal(params.messages[2]?.role, 'tool')
  assert.equal(params.messages[2]?.toolResults?.[0]?.id, 't1')
  assert.deepEqual(params.tools[0], { name: 'f', description: 'd', inputSchema: { type: 'object' } })
})

test('llmResponseToOpenAICompletion maps content, tool calls, finish reason, usage', () => {
  const completion = llmResponseToOpenAICompletion(
    {
      content: 'hi',
      toolCalls: [{ id: 't1', name: 'f', input: { a: 1 } }],
      stopReason: 'tool_use',
      usage: { inputTokens: 3, outputTokens: 4 },
    },
    'gpt-4o',
    'id1',
  )

  assert.equal(completion.object, 'chat.completion')
  assert.equal(completion.choices[0]?.finish_reason, 'tool_calls')
  assert.equal(completion.choices[0]?.message.tool_calls?.[0]?.function.arguments, '{"a":1}')
  assert.deepEqual(completion.usage, { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 })
})
