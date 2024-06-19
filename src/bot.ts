import { Context, Probot } from 'probot';
import minimatch from 'minimatch';

import { Chat } from './chat.js';

const OPENAI_API_KEY = 'OPENAI_API_KEY';
const MAX_PATCH_COUNT = process.env.MAX_PATCH_LENGTH
  ? +process.env.MAX_PATCH_LENGTH
  : 10000;

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

  app.on(
    ['pull_request.opened', 'pull_request.synchronize'],
    async (context) => {
      const repo = context.repo();
      const chat = await loadChat(context);

      if (!chat) {
        console.log('Chat initialized failed');
        return 'no chat';
      }

      const pull_request = context.payload.pull_request;

      if (
        pull_request.state === 'closed' ||
        pull_request.locked
      ) {
        console.log('invalid event payload');
        return 'invalid event payload';
      }

      const noReviewLabels = [
        'no-review-by-ChatGPT',
        'renovate/Major',
        'renovate/Minor',
        'renovate/Patch',
        'renovate/security'
      ]
      if (pull_request.labels?.some(label => noReviewLabels.includes(label.name))) {
        console.log('no-review label is attached.');
        return 'no-review label is attached.'
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

      const data = await context.octokit.repos.compareCommits({
        owner: repo.owner,
        repo: repo.repo,
        base: context.payload.pull_request.base.sha,
        head: context.payload.pull_request.head.sha,
      });

      const { files: changedFiles, commits } = data.data;
      if (!changedFiles?.length) {
        console.log('no change found');
        return 'no change found';
      }

      console.time('gpt cost');

      for (let i = 0; i < changedFiles.length; i++) {
        const file = changedFiles[i];
        const patch = file.patch || '';

        if (file.status !== 'modified' && file.status !== 'added') {
          continue;
        }

        if (!targets.some(target => minimatch(file.filename, target))) {
          console.log(`${file.filename} is not in targets.`);
          continue;
        }

        if (ignoreList.some(ignore => minimatch(file.filename, ignore))) {
          console.log(`${file.filename} is ignored.`);
          continue;
        }

        if (!patch || patch.length > MAX_PATCH_COUNT) {
          console.log(`${file.filename} skipped caused by its diff is too large.`);
          continue;
        }

        try {
          const res = await chat?.codeReview(patch);

          if (!!res) {
            await context.octokit.pulls.createReviewComment({
              repo: repo.repo,
              owner: repo.owner,
              pull_number: context.pullRequest().pull_number,
              commit_id: commits[commits.length - 1].sha,
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
      console.info(
        'successfully reviewed',
        context.payload.pull_request.html_url
      );

      return 'success';
    }
  );
};
