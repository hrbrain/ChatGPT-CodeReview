# CodeReview BOT

> A code review robot powered by ChatGPT

Translation Versions: [ENGLISH](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## Bot Usage

❗️⚠️ `Due to cost considerations, BOT is only used for testing purposes and is currently deployed on AWS Lambda with ratelimit restrictions. Therefore, unstable situations are completely normal. It is recommended to deploy an app by yourself.`

### Install

Install: [apps/cr-gpt](https://github.com/apps/cr-gpt);

### Configuration

1. Go to the repo homepage which you want integrate this bot
2. click `settings`
3. click `actions` under `secrets and variables`
4. Change to `Variables` tab, create a new variable `OPENAI_API_KEY` with the value of your open api key (For Github Action integration, set it in secrets)
   <img width="1465" alt="image" src="https://user-images.githubusercontent.com/13167934/218533628-3974b70f-c423-44b0-b096-d1ec2ace85ea.png">

### Start using

1. The robot will automatically do the code review when you create a new Pull request, the review information will show in the pr timeline / file changes part.
2. After `git push` update the pull request, cr bot will re-review the changed files

example:

[ChatGPT-CodeReview/pull/21](https://github.com/anc95/ChatGPT-CodeReview/pull/21)

<img width="1052" alt="image" src="https://user-images.githubusercontent.com/13167934/218999459-812206e1-d8d2-4900-8ce8-19b5b6e1f5cb.png">

## Using Github Actions

[actions/chatgpt-codereviewer](https://github.com/marketplace/actions/chatgpt-codereviewer)

1. Add the `OPENAI_API_KEY` to your github actions secrets
1. Create `.github/workflows/cr.yml` add bellow content
1. When a PR is opened or a commit is pushed to it, ChatGPT reviews the changes and comments to the PR.
    1. If a PR has one of the following labels, ChatGPT does not review.
        1. `no-review-by-ChatGPT`
        1. `renovate/Major`
        1. `renovate/Minor`
        1. `renovate/Patch`
        1. `renovate/security`

```yml
name: Code Review

permissions:
  contents: read
  pull-requests: write

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    if: github.event_name == 'pull_request'
    steps:
      - uses: hrbrain/ChatGPT-CodeReview@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          TARGETS: 'app/***,libs/**' # comma separated
          IGNORE: '**/*.pb.go,**/mocks/**' # comma separated, please set NONE when no file is ignored.
          # Optional
          LANGUAGE: English # Default: Japanese
          OPENAI_API_ENDPOINT: https://api.openai.com/v1
          MODEL: gpt-3.5-turbo # Default: gpt-4o, https://platform.openai.com/docs/models
          PROMPT: Please review the changes # Default: Below is a code patch, please help me do a brief code review on it. Any bug risks and/or improvement suggestions are welcome
          top_p: 0.5 # Default: 1, https://platform.openai.com/docs/api-reference/chat/create#chat-create-top_p
          temperature: 0.5 # Default: 1, https://platform.openai.com/docs/api-reference/chat/create#chat-create-temperature
          max_tokens: 10000 # Default: undefined, https://platform.openai.com/docs/api-reference/chat/create#chat-create-max_tokens
          MAX_PATCH_LENGTH: 5000 # Default: 50000, if the patch/diff length is large than MAX_PATCH_LENGTH, will be ignored and won't review. By default, with no MAX_PATCH_LENGTH set, there is also no limit for the patch/diff length.
```

## Self-hosting

1. clone code
2. copy `.env.example` to `.env`, and fill the env variables
3. install deps and run

```sh
npm i
npm i -g pm2
npm run build
pm2 start pm2.config.cjs
```

[probot](https://probot.github.io/docs/development/) for more detail

## Dev

### Setup

```sh
# Install dependencies
npm install

# Build code
npm run build

# Run the bot
npm run start
```

### Docker

```sh
# 1. Build container
docker build -t cr-bot .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> cr-bot
```

## Contributing

If you have suggestions for how cr-bot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## Credit

this project is inpired by [codereview.gpt](https://github.com/sturdy-dev/codereview.gpt)

## License

[ISC](LICENSE) © 2023 anc95
