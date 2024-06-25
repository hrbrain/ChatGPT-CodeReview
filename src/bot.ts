import { Context, Probot } from 'probot';
import minimatch from 'minimatch';

import { Chat } from './chat.js';

const OPENAI_API_KEY = 'OPENAI_API_KEY';
const MAX_PATCH_LENGTH = process.env.MAX_PATCH_LENGTH
  ? +process.env.MAX_PATCH_LENGTH
  : 50000;

type PullRequest = {
  pullNumber: number;
  baseSha: string;
  headSha: string;
  labels: string[];
  state: 'open' | 'closed';
  locked: boolean;
  url: string;
};

const noReviewLabels = [
  'no-review-by-ChatGPT',
  'renovate/Major',
  'renovate/Minor',
  'renovate/Patch',
  'renovate/security'
]

export const robot = (app: Probot) => {
  const loadChat = async (context: Context) => {
    if (process.env.OPENAI_API_KEY) {
      return new Chat(process.env.OPENAI_API_KEY);
    }

    const repo = context.repo();

    try {
      const { data } = (await context.octokit.request(
        'GET /repos/{owner}/{repo}/actions/variables/{name}',
        {
          owner: repo.owner,
          repo: repo.repo,
          name: OPENAI_API_KEY,
        }
      )) as any;

      if (!data?.value) {
        return null;
      }

      return new Chat(data.value);
    } catch {
      await context.octokit.issues.createComment({
        repo: repo.repo,
        owner: repo.owner,
        issue_number: context.pullRequest().pull_number,
        body: `Seems you are using me but didn't get OPENAI_API_KEY seted in Variables/Secrets for this repo. you could follow [readme](https://github.com/anc95/ChatGPT-CodeReview) for more information`,
      });
      return null;
    }
  };

  const review = async (context: Context, pullRequest: PullRequest) => {
    if (pullRequest.state === 'closed') {
      console.log('pull request is closed');
      return 'pull request is closed';
    } else if (pullRequest.locked) {
      console.log('pull request is locked');
      return 'pull request is locked';
    } else if (process.env.TRIGGER !== 'command' && pullRequest.labels?.some(label => noReviewLabels.includes(label))) {
      console.log('no-review label is attached');
      return 'no-review label is attached'
    }

    const targets = (process.env.TARGETS || process.env.targets || '')
      .split(',')
      .filter((v) => v !== '');
    if (targets.length === 0) {
      console.log('no target specified');
      return 'no target specified';
    }

    var ignoreList: string[] = []
    const ignore = process.env.IGNORE || process.env.ignore || '';
    if (ignore === '') {
      console.log('no ignore specified');
      return 'no ignore specified';
    } else if (ignore !== 'NONE') {
      ignoreList = ignore
        .split(',')
        .filter((v) => v !== '');
      if (ignoreList.length === 0) {
        console.log('no ignore specified');
        return 'no ignore specified';
      }
    }

    const chat = await loadChat(context);
    if (!chat) {
      console.log('failed to initialize Chat');
      return 'failed to initialize Chat';
    }

    const repo = context.repo();
    const data = await context.octokit.repos.compareCommits({
      owner: repo.owner,
      repo: repo.repo,
      base: pullRequest.baseSha,
      head: pullRequest.headSha,
    });

    const { files: changedFiles } = data.data;
    if (!changedFiles?.length) {
      console.log('no change found');
      return 'no change found';
    }

    console.time('gpt cost');

    for (let i = 0; i < changedFiles.length; i++) {
      const file = changedFiles[i];
      const patch = file.patch || '';
      if (file.status !== 'modified' && file.status !== 'added') {
        console.log(`${file.filename} is not modified or added`);
        continue;
      } else if (!targets.some(target => minimatch(file.filename, target))) {
        console.log(`${file.filename} is not in targets`);
        continue;
      } else if (ignoreList.some(ignore => minimatch(file.filename, ignore))) {
        console.log(`${file.filename} is ignored`);
        continue;
      } else if (!patch || patch.length > MAX_PATCH_LENGTH) {
        console.log(`${file.filename} skipped caused by its diff is too large`);
        continue;
      }

      console.log(`${file.filename} is reviewed`);
      try {
        const res = await chat.codeReview(file.filename, patch);
        if (!!res) {
          await context.octokit.pulls.createReviewComment({
            repo: repo.repo,
            owner: repo.owner,
            pull_number: pullRequest.pullNumber,
            commit_id: pullRequest.headSha,
            path: file.filename,
            body: res,
            position: patch.split('\n').length - 1,
          });
        }
      } catch (e) {
        console.error(`review ${file.filename} failed`, e);
      }
    }

    console.timeEnd('gpt cost');
    console.info('successfully reviewed', pullRequest.url);

    return 'success';
  };

  app.on(
    ['repository_dispatch'],
    async (context) => {
      const pr = context.payload.client_payload.pull_request as any;
      const pullRequest: PullRequest = {
        pullNumber: pr.number as number,
        baseSha: pr.base.sha as string,
        headSha: pr.head.sha as string,
        labels: pr.labels?.map((l: any) => l.name) as string[],
        state: pr.state as 'open' | 'closed',
        locked: pr.locked as boolean,
        url: pr.html_url as string
      };

      return await review(context, pullRequest);
    }
  );

  app.on(
    ['pull_request.opened', 'pull_request.synchronize'],
    async (context) => {
      const pr = context.payload.pull_request;
      const pullRequest: PullRequest = {
        pullNumber: context.pullRequest().pull_number,
        baseSha: pr.base.sha,
        headSha: pr.head.sha,
        labels: pr.labels?.map(l => l.name),
        state: pr.state,
        locked: pr.locked,
        url: pr.html_url
      };

      return await review(context, pullRequest);
    }
  );
};
