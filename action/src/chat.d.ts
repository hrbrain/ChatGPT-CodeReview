export declare class Chat {
    private chatAPI;
    constructor(apikey: string);
    private generatePrompt;
    codeReview: (filePath: string, patch: string) => Promise<string>;
}
