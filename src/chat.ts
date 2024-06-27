import { ChatGPTAPI } from 'chatgpt';
export class Chat {
  private chatAPI: ChatGPTAPI;

  constructor(apikey: string) {
    this.chatAPI = new ChatGPTAPI({
      apiKey: apikey,
      apiBaseUrl:
        process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1',
      maxModelTokens: 20000,
      completionParams: {
        model: process.env.MODEL || 'gpt-4o',
        temperature: +(process.env.temperature || 0) || 1,
        top_p: +(process.env.top_p || 0) || 1,
        max_tokens: process.env.max_tokens
          ? +process.env.max_tokens
          : 4000,
      },
    });
  }

  private generatePrompt = (fileExtension: string, patch: string) => {
    const answerLanguage = process.env.LANGUAGE ? process.env.LANGUAGE : 'Japanese';
    if (!!process.env.PROMPT){
      return `${process.env.PROMPT}, Answer me in ${answerLanguage}:
      ${patch}
      `;
    } else {
      const fileTypeMessage = fileExtension !== '' ? ` for a ${fileExtension} file` : '';

      return `You are a skilled software engineer.
Below is a code patch${fileTypeMessage}. Please help me review it.
The review comment must be in the following format in ${answerLanguage} and Review Summary must include positive messages and compliments.

Patch

\`\`\`
${patch}
\`\`\`

Review Format

## Review Summary

## Bug Risks

### 1. ~ (1st risk, please fill the title)

(Please continue to comment as needed.)

## Improvement Suggestions

### 1. ~ (1st suggestion, please fill the title)

(Please continue to comment as needed.)`;
    }
  };

  public codeReview = async (filePath: string, patch: string) => {
    if (!patch) {
      return '';
    }

    const fileName = filePath.split('/').at(-1) as string;
    const splitFileName = fileName.split('.');
    const fileExtension = splitFileName.length > 1 ? splitFileName.at(-1) as string : '';

    console.time('code-review cost');
    const prompt = this.generatePrompt(fileExtension, patch);
    const res = await this.chatAPI.sendMessage(prompt);
    console.timeEnd('code-review cost');

    return res.text;
  };
}
