// Responses-shaped fixtures for the Demo Gateway and readers for its request body.
// Text and image requests both use /demo/v1/responses.
export const isInference = path => path.endsWith('/responses');
export const responsesReply = (value, usage = {total_tokens:15}) => ({
  status:'completed',
  output:[{type:'message',content:[{type:'output_text',text:typeof value === 'string' ? value : JSON.stringify(value)}]}],
  usage
});
// The model's answer text from a Responses body (what the UI parses).
export const replyText = body => (body?.output || []).filter(item=>item.type === 'message').flatMap(item=>item.content || [])
  .filter(part=>part.type === 'output_text').map(part=>part.text).join('');
// The user's text, i.e. the JSON context the panel shares (formerly wire.messages[1].content).
export const userText = wire => wire.input.find(item=>item.role === 'user').content.find(part=>part.type === 'input_text').text;
