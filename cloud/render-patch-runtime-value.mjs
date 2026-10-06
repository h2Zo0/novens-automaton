import fs from "node:fs";

function replaceOnce(file, from, to) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error("NOVENS runtime-value patch target not found in " + file);
  fs.writeFileSync(file, src.replace(from, to));
}

const upstream = "src/self-mod/upstream.ts";
fs.writeFileSync(upstream, Buffer.from("LyoqCiAqIFVwc3RyZWFtIEF3YXJlbmVzcwogKgogKiBDbG91ZC1zYWZlIGhlbHBlcnMgZm9yIE5PVkVOUyB0byBpbnNwZWN0IHRoZSBwZXJzaXN0ZW50IEdpdCBtaXJyb3IuCiAqIEdpdCBhd2FyZW5lc3MgaXMgcmVhZC1vbmx5IGF0IHJ1bnRpbWU7IGRlcGxveW1lbnQgc3RpbGwgZ29lcyB0aHJvdWdoCiAqIEdpdEh1Yi9SZW5kZXIuCiAqLwoKaW1wb3J0IHsgZXhlY0ZpbGVTeW5jIH0gZnJvbSAibm9kZTpjaGlsZF9wcm9jZXNzIjsKCmNvbnN0IFJFUE9fUk9PVCA9IHByb2Nlc3MuZW52Lk5PVkVOU19HSVRfUkVQT19ESVIgfHwgcHJvY2Vzcy5jd2QoKTsKY29uc3QgVVBTVFJFQU1fQlJBTkNIID0KICBwcm9jZXNzLmVudi5OT1ZFTlNfVVBTVFJFQU1fQlJBTkNIIHx8CiAgcHJvY2Vzcy5lbnYuTk9WRU5TX0NISUxEX1JFUE9fQlJBTkNIIHx8CiAgIm1haW4iOwoKZnVuY3Rpb24gZ2l0KGFyZ3M6IHN0cmluZ1tdKTogc3RyaW5nIHsKICByZXR1cm4gZXhlY0ZpbGVTeW5jKCJnaXQiLCBhcmdzLCB7CiAgICBjd2Q6IFJFUE9fUk9PVCwKICAgIGVuY29kaW5nOiAidXRmLTgiLAogICAgdGltZW91dDogMTVfMDAwLAogIH0pLnRyaW0oKTsKfQoKZXhwb3J0IGZ1bmN0aW9uIGdldFJlcG9JbmZvKCk6IHsKICBvcmlnaW5Vcmw6IHN0cmluZzsKICBicmFuY2g6IHN0cmluZzsKICBoZWFkSGFzaDogc3RyaW5nOwogIGhlYWRNZXNzYWdlOiBzdHJpbmc7CiAgcmVtb3RlSGVhZEhhc2g6IHN0cmluZzsKfSB7CiAgY29uc3QgcmF3VXJsID0gZ2l0KFsiY29uZmlnIiwgIi0tZ2V0IiwgInJlbW90ZS5vcmlnaW4udXJsIl0pOwogIGNvbnN0IG9yaWdpblVybCA9IHJhd1VybC5yZXBsYWNlKC9cL1wvW15AXStALywgIi8vIik7CiAgY29uc3QgaGVhZExpbmUgPSBnaXQoWyJsb2ciLCAiLTEiLCAiLS1mb3JtYXQ9JUh8fHwlcyJdKTsKICBjb25zdCBbZnVsbEhlYWRIYXNoLCBoZWFkTWVzc2FnZSA9ICIiXSA9IGhlYWRMaW5lLnNwbGl0KCJ8fHwiKTsKICBsZXQgcmVtb3RlSGVhZEhhc2ggPSAiIjsKICB0cnkgewogICAgcmVtb3RlSGVhZEhhc2ggPSBnaXQoWyJyZXYtcGFyc2UiLCBgb3JpZ2luLyR7VVBTVFJFQU1fQlJBTkNIfWBdKTsKICB9IGNhdGNoIHsKICAgIC8vIEEgZmV0Y2ggaW4gY2hlY2tVcHN0cmVhbSB3aWxsIHBvcHVsYXRlIGl0LgogIH0KICByZXR1cm4gewogICAgb3JpZ2luVXJsLAogICAgYnJhbmNoOiBVUFNUUkVBTV9CUkFOQ0gsCiAgICBoZWFkSGFzaDogZnVsbEhlYWRIYXNoLAogICAgaGVhZE1lc3NhZ2UsCiAgICByZW1vdGVIZWFkSGFzaCwKICB9Owp9CgpleHBvcnQgZnVuY3Rpb24gY2hlY2tVcHN0cmVhbSgpOiB7CiAgYmVoaW5kOiBudW1iZXI7CiAgY29tbWl0czogeyBoYXNoOiBzdHJpbmc7IG1lc3NhZ2U6IHN0cmluZyB9W107CiAgcmVtb3RlSGVhZEhhc2g6IHN0cmluZzsKICBsb2NhbEhlYWRIYXNoOiBzdHJpbmc7CiAgYnJhbmNoOiBzdHJpbmc7Cn0gewogIGdpdChbImZldGNoIiwgIm9yaWdpbiIsIFVQU1RSRUFNX0JSQU5DSCwgIi0tcXVpZXQiXSk7CiAgY29uc3QgbG9jYWxIZWFkSGFzaCA9IGdpdChbInJldi1wYXJzZSIsICJIRUFEIl0pOwogIGNvbnN0IHJlbW90ZUhlYWRIYXNoID0gZ2l0KFsicmV2LXBhcnNlIiwgYG9yaWdpbi8ke1VQU1RSRUFNX0JSQU5DSH1gXSk7CiAgY29uc3QgbG9nID0gZ2l0KFsibG9nIiwgYEhFQUQuLm9yaWdpbi8ke1VQU1RSRUFNX0JSQU5DSH1gLCAiLS1vbmVsaW5lIl0pOwogIGlmICghbG9nKSB7CiAgICByZXR1cm4gewogICAgICBiZWhpbmQ6IDAsCiAgICAgIGNvbW1pdHM6IFtdLAogICAgICByZW1vdGVIZWFkSGFzaCwKICAgICAgbG9jYWxIZWFkSGFzaCwKICAgICAgYnJhbmNoOiBVUFNUUkVBTV9CUkFOQ0gsCiAgICB9OwogIH0KICBjb25zdCBjb21taXRzID0gbG9nLnNwbGl0KCJcbiIpLm1hcCgobGluZSkgPT4gewogICAgY29uc3QgW2hhc2gsIC4uLnJlc3RdID0gbGluZS5zcGxpdCgiICIpOwogICAgcmV0dXJuIHsgaGFzaCwgbWVzc2FnZTogcmVzdC5qb2luKCIgIikgfTsKICB9KTsKICByZXR1cm4gewogICAgYmVoaW5kOiBjb21taXRzLmxlbmd0aCwKICAgIGNvbW1pdHMsCiAgICByZW1vdGVIZWFkSGFzaCwKICAgIGxvY2FsSGVhZEhhc2gsCiAgICBicmFuY2g6IFVQU1RSRUFNX0JSQU5DSCwKICB9Owp9CgpleHBvcnQgZnVuY3Rpb24gZ2V0VXBzdHJlYW1EaWZmcygpOiB7CiAgaGFzaDogc3RyaW5nOwogIG1lc3NhZ2U6IHN0cmluZzsKICBhdXRob3I6IHN0cmluZzsKICBkaWZmOiBzdHJpbmc7Cn1bXSB7CiAgY29uc3QgbG9nID0gZ2l0KFsKICAgICJsb2ciLAogICAgYEhFQUQuLm9yaWdpbi8ke1VQU1RSRUFNX0JSQU5DSH1gLAogICAgIi0tZm9ybWF0PSVIICVhbnx8fCVzIiwKICBdKTsKICBpZiAoIWxvZykgcmV0dXJuIFtdOwoKICByZXR1cm4gbG9nLnNwbGl0KCJcbiIpLm1hcCgobGluZSkgPT4gewogICAgY29uc3QgW2hhc2hBbmRBdXRob3IsIG1lc3NhZ2VdID0gbGluZS5zcGxpdCgifHx8Iik7CiAgICBjb25zdCBwYXJ0cyA9IGhhc2hBbmRBdXRob3Iuc3BsaXQoIiAiKTsKICAgIGNvbnN0IGhhc2ggPSBwYXJ0c1swXTsKICAgIGNvbnN0IGF1dGhvciA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oIiAiKTsKICAgIGxldCBkaWZmOiBzdHJpbmc7CiAgICB0cnkgewogICAgICBkaWZmID0gZ2l0KFsiZGlmZiIsIGAke2hhc2h9fjEuLiR7aGFzaH1gXSk7CiAgICB9IGNhdGNoIHsKICAgICAgZGlmZiA9IGdpdChbInNob3ciLCBoYXNoLCAiLS1mb3JtYXQ9IiwgIi0tc3RhdCJdKTsKICAgIH0KICAgIHJldHVybiB7IGhhc2g6IGhhc2guc2xpY2UoMCwgMTIpLCBtZXNzYWdlLCBhdXRob3IsIGRpZmYgfTsKICB9KTsKfQo=", "base64").toString("utf8"));

replaceOnce(
  "src/heartbeat/tasks.ts",
  `      if (upstream.behind > 0) {
        // Only wake if the commit count changed since last check
        const prevBehind = taskCtx.db.getKV("upstream_prev_behind");
        const behindStr = String(upstream.behind);
        if (prevBehind !== behindStr) {
          taskCtx.db.setKV("upstream_prev_behind", behindStr);
          return {
            shouldWake: true,
            message: \`\${upstream.behind} new commit(s) on origin/\${repo.branch}. Review with review_upstream_changes before any deployment action.\`,
          };
        }
      } else {
        taskCtx.db.deleteKV("upstream_prev_behind");
      }
`,
  `      if (upstream.behind > 0) {
        const seenRemoteHead = taskCtx.db.getKV("upstream_seen_remote_head");
        if (seenRemoteHead !== upstream.remoteHeadHash) {
          taskCtx.db.setKV("upstream_seen_remote_head", upstream.remoteHeadHash);
          return {
            shouldWake: true,
            message: \`\${upstream.behind} new commit(s) on origin/\${upstream.branch}. Remote HEAD \${upstream.remoteHeadHash.slice(0,12)}. Review once; do not re-wake for the same HEAD.\`,
          };
        }
      } else {
        taskCtx.db.setKV("upstream_seen_remote_head", upstream.remoteHeadHash);
      }
`
);

replaceOnce(
  "src/index.ts",
  `            const upstream = checkUpstream();
            meaningfulWake = upstream.behind > 0;
            if (meaningfulWake) {
              logger.info(
                \`[VALUE HOLD] Git changed: \${upstream.behind} commit(s) available. Resuming productive inference.\`,
              );
              insertWakeEvent(db.raw, "heartbeat", "git mission/code changed while in value hold");
            }
`,
  `            const upstream = checkUpstream();
            const seenRemoteHead = db.getKV("upstream_seen_remote_head");
            meaningfulWake =
              upstream.behind > 0 &&
              seenRemoteHead !== upstream.remoteHeadHash;
            if (meaningfulWake) {
              db.setKV("upstream_seen_remote_head", upstream.remoteHeadHash);
              logger.info(
                \`[VALUE HOLD] New Git HEAD \${upstream.remoteHeadHash.slice(0,12)}: \${upstream.behind} commit(s). Resuming inference once.\`,
              );
              insertWakeEvent(
                db.raw,
                "heartbeat",
                \`new git remote head \${upstream.remoteHeadHash.slice(0,12)} while in value hold\`,
              );
            } else if (upstream.behind === 0) {
              db.setKV("upstream_seen_remote_head", upstream.remoteHeadHash);
            }
`
);

replaceOnce(
  "src/orchestration/orchestrator.ts",
  `    let state = this.loadState();

    try {
`,
  `    let state = this.loadState();

    if (state.goalId) {
      const persistedGoal = getGoalById(this.params.db, state.goalId);
      if (!persistedGoal || persistedGoal.status !== "active") {
        logger.warn("Clearing stale orchestrator goal reference", {
          goalId: state.goalId,
          status: persistedGoal?.status ?? "missing",
        });
        state = {
          ...state,
          phase: "idle",
          goalId: null,
          failedTaskId: null,
          failedError: null,
          replanCount: 0,
        };
      }
    }

    try {
`
);

fs.writeFileSync(
  "src/agent/value-system-prompt.ts",
  Buffer.from("aW1wb3J0IHR5cGUgewogIEF1dG9tYXRvbkNvbmZpZywKICBBdXRvbWF0b25JZGVudGl0eSwKICBGaW5hbmNpYWxTdGF0ZSwKICBBZ2VudFN0YXRlLAp9IGZyb20gIi4uL3R5cGVzLmpzIjsKCmV4cG9ydCBmdW5jdGlvbiBidWlsZFZhbHVlRmlyc3RTeXN0ZW1Qcm9tcHQocGFyYW1zOiB7CiAgaWRlbnRpdHk6IEF1dG9tYXRvbklkZW50aXR5OwogIGNvbmZpZzogQXV0b21hdG9uQ29uZmlnOwogIGZpbmFuY2lhbDogRmluYW5jaWFsU3RhdGU7CiAgc3RhdGU6IEFnZW50U3RhdGU7CiAgZ2l0TWlzc2lvbjogc3RyaW5nOwp9KTogc3RyaW5nIHsKICBjb25zdCB7IGlkZW50aXR5LCBjb25maWcsIGZpbmFuY2lhbCwgc3RhdGUsIGdpdE1pc3Npb24gfSA9IHBhcmFtczsKICByZXR1cm4gYFlvdSBhcmUgJHtjb25maWcubmFtZX0sIGFuIGF1dG9ub21vdXMgZWNvbm9taWMgYWdlbnQuCgpTT1VSQ0UgT0YgVFJVVEgKVGhlIE5PVkVOUyBtaXNzaW9uIGxvYWRlZCBmcm9tIHRoZSBwZXJzaXN0ZW50IGNsb3VkIEdpdCByZXBvc2l0b3J5IGlzIGF1dGhvcml0YXRpdmUgZm9yIGJ1c2luZXNzIGJlaGF2aW9yLiBGb2xsb3cgaXQgYmVmb3JlIGNyZWF0aW5nIGdvYWxzIG9yIHNwZW5kaW5nIGluZmVyZW5jZS4KCjxnaXRfbWlzc2lvbj4KJHtnaXRNaXNzaW9ufQo8L2dpdF9taXNzaW9uPgoKQ1VSUkVOVCBTVEFURQotIGFnZW50OiAke2lkZW50aXR5LmFkZHJlc3N9Ci0gcnVudGltZSBzdGF0ZTogJHtzdGF0ZX0KLSBpbmZlcmVuY2UgbW9kZWw6ICR7Y29uZmlnLmluZmVyZW5jZU1vZGVsfQotIGNvbXB1dGUgY3JlZGl0czogJHtmaW5hbmNpYWwuY3JlZGl0c0NlbnRzfSBjZW50cwotIHdhbGxldCBVU0RDIHZpZXc6ICR7ZmluYW5jaWFsLnVzZGNCYWxhbmNlfQotIG93bmVyOiAke2NvbmZpZy5vd25lckFkZHJlc3MgfHwgY29uZmlnLmNyZWF0b3JBZGRyZXNzfQoKTk9OLU5FR09USUFCTEUgRUNPTk9NSUMgUlVMRVMKMS4gVmVyaWZpZWQgZXh0ZXJuYWwgbmV0IHZhbHVlIGFuZCBvd25lciBwYXlvdXQgYXJlIHRoZSBvYmplY3RpdmUuIEFjdGl2aXR5LCBwbGFucywgZmlsZXMsIHR1cm5zIGFuZCBib3QgY291bnQgYXJlIG5vdCB2YWx1ZSBieSB0aGVtc2VsdmVzLgoyLiBOZXZlciByZXBlYXQgc3RhdHVzIGNoZWNrcywgcGxhbnMsIFJFQURNRS9XT1JLTE9HIHJld3JpdGVzLCBvciBibG9ja2VkIGFjdGlvbnMganVzdCB0byBzdGF5IGJ1c3kuCjMuIFVzZSB0aGUgZmV3ZXN0IGluZmVyZW5jZSBjYWxscyBuZWNlc3NhcnkuIFByZWZlciBkZXRlcm1pbmlzdGljIHRvb2xzIGFuZCBleGlzdGluZyBpbmZvcm1hdGlvbiBvdmVyIGFub3RoZXIgcmVhc29uaW5nIHR1cm4uCjQuIEEgbmV3IGNoaWxkIGlzIG9wdGlvbmFsIGFuZCBtYXkgZXhpc3Qgb25seSBpZiB0aGUgaGFyZCBlY29ub21pYyBnYXRlIHBlcm1pdHMgaXQuIFRoZSBwYXJlbnQgbmVlZHMgYXQgbGVhc3QgRVVSIDE1MCwgcHJpb3IgY2hpbGQtY3JlYXRpb24gb2JsaWdhdGlvbnMgbXVzdCBiZSBzZXR0bGVkLCBFVVIgNTAgaXMgb3dlZCB0byB0aGUgb3duZXIsIEVVUiA1MCBmdW5kcyB0aGUgY2hpbGQsIGFuZCBhdCBsZWFzdCBFVVIgNTAgcmVtYWlucyB3aXRoIHRoZSBwYXJlbnQuCjUuIEV4aXN0aW5nIGNoaWxkcmVuLCBmYWlsdXJlcywgZGVidHMgYW5kIGhpc3RvcnkgbWF5IG5vdCBiZSBlcmFzZWQgdG8gcmVzZXQgbGltaXRzLgo2LiBEbyBub3QgY2xhaW0gZmljdGl2ZS9wYXBlciB2YWx1ZSBhcyByZWFsIHJldmVudWUuCjcuIElmIGEgdGFzayBpcyBibG9ja2VkLCBlaXRoZXIgdGFrZSBhIG1hdGVyaWFsbHkgZGlmZmVyZW50IGFjdGlvbiB0aGF0IGFkdmFuY2VzIHJldmVudWUgb3Igc3RvcCBjb25zdW1pbmcgaW5mZXJlbmNlIGFuZCB3YWl0IGZvciBhIG1lYW5pbmdmdWwgR2l0L2Vjb25vbWljL2V4dGVybmFsIGV2ZW50Lgo4LiBDb21wdXRlIGFuZCBpbmZlcmVuY2UgYXJlIG9wZXJhdGluZyBleHBlbnNlcy4gUHJlc2VydmUgdGhlIHBhcmVudCdzIHByb3RlY3RlZCByZXNlcnZlIGFuZCBhbGwgYW1vdW50cyBhbHJlYWR5IG93ZWQgYmVmb3JlIGRpc2NyZXRpb25hcnkgc3BlbmRpbmcuCjkuIFdoZW4gYSB3YWxsZXQtcGF5YWJsZSBpbmZlcmVuY2UgcHJvdmlkZXIgaXMgY29uZmlndXJlZCBhbmQgZnJlZSBzcGVuZGFibGUgZnVuZHMgZXhpc3QsIGJ1eSBvbmx5IHRoZSBzbWFsbGVzdCBjcmVkaXQgdGllciBuZWVkZWQuIE5ldmVyIHNwZW5kIHByb3RlY3RlZCByZXNlcnZlIG9yIG93ZWQgZnVuZHMgb24gaW5mZXJlbmNlLgoxMC4gSWYgbm8gd2FsbGV0LXBheWFibGUgcHJvdmlkZXIgaXMgYXZhaWxhYmxlLCBkbyBub3QgcHJldGVuZCB0aGUgYWdlbnQgaXMgc2VsZi1mdW5kZWQ7IG9iZXkgdGhlIGluZmVyZW5jZSBidWRnZXQgYW5kIGVudGVyIHZhbHVlLWhvbGQgcmF0aGVyIHRoYW4gYnVybmluZyBleHRlcm5hbGx5IGJpbGxlZCBBUEkgY3JlZGl0cy4KCkNPTVBVVEUKJHtwcm9jZXNzLmVudi5EQVlUT05BX0FQSV9LRVkgPyBgRGF5dG9uYSBjb21wdXRlIGlzIGF2YWlsYWJsZS4gVGhlIGV4ZWMvd3JpdGVfZmlsZS9yZWFkX2ZpbGUgdG9vbHMgb3BlcmF0ZSBvbiBhbiBpc29sYXRlZCBEYXl0b25hIHdvcmtzcGFjZSBmb3IgdGhlIHBhcmVudC4gVXNlIHRoYXQgd29ya3NwYWNlIHRvIGJ1aWxkLCBydW4gYW5kIHRlc3QgcmVhbCBjb2RlLiBEbyBub3QgbWVyZWx5IHBsYW4gd29yayB0aGF0IGNhbiBiZSBleGVjdXRlZCB0aGVyZS4gQ2hpbGQgY3JlYXRpb24gcmVtYWlucyBnb3Zlcm5lZCBieSB0aGUgZWNvbm9taWMgZ2F0ZS5gIDogYE5vIGV4dGVybmFsIGNvbXB1dGUgc2FuZGJveCBpcyBjdXJyZW50bHkgY29uZmlndXJlZC4gQXZvaWQgcHJldGVuZGluZyBibG9ja2VkIGV4ZWN1dGlvbiBzdWNjZWVkZWQuYH0KCkVYRUNVVElPTiBESVNDSVBMSU5FClRha2Ugb25lIGNvbmNyZXRlIG5leHQgYWN0aW9uLiBBIHR1cm4gbXVzdCBlaXRoZXIgaW5jcmVhc2UgdmVyaWZpZWQgZWNvbm9taWMgdmFsdWUsIGNvbXBsZXRlIGEgcmVhbCB0YXNrLCBjcmVhdGUgb25lIG5ldyBuZWNlc3NhcnkgYXJ0aWZhY3QsIHJlbW92ZSBhIHJlYWwgYmxvY2tlciwgb3IgcGVyZm9ybSBhIGxlZ2l0aW1hdGUgZXh0ZXJuYWwgcmV2ZW51ZSBhY3Rpb24uCklmIG5vIGFjdGl2ZSBnb2FsIGV4aXN0cywgZGVyaXZlIGV4YWN0bHkgb25lIGNvbmNyZXRlIHJldmVudWUtcHJvZHVjaW5nIGdvYWwgZnJvbSB0aGUgR2l0IG1pc3Npb24gYW5kIGNyZWF0ZSBpdC4gRG8gbm90IHNwZW5kIGEgdHVybiBjYWxsaW5nIGxpc3RfZ29hbHMvb3JjaGVzdHJhdG9yX3N0YXR1cyBqdXN0IHRvIGRpc2NvdmVyIHRoYXQgbm90aGluZyBpcyBhY3RpdmUuCldoZW4gRGF5dG9uYSBjb21wdXRlIGlzIGF2YWlsYWJsZSwgcHJlZmVyIGV4ZWMgcGx1cyByZWFsIGNvZGUvdGVzdHMgb3ZlciBzdGF0dXMgaW5zcGVjdGlvbiBvciBkb2N1bWVudGF0aW9uLgpPdGhlcndpc2UgZG8gbm90IGxvb3AuCmA7Cn0K", "base64").toString("utf8"),
);

replaceOnce(
  "src/agent/loop.ts",
  `      const inferenceTools = toolsToInferenceFormat(tools);
      const routerResult = await inferenceRouter.route(
`,
  `      let toolsForInference = tools;
      if (valueMode && daytonaComputeEnabled) {
        let activeGoalCount = 0;
        try {
          const row = db.raw
            .prepare("SELECT COUNT(*) AS c FROM goals WHERE status = 'active'")
            .get() as { c: number } | undefined;
          activeGoalCount = row?.c ?? 0;
        } catch {
          activeGoalCount = 0;
        }

        if (activeGoalCount === 0) {
          const blockedIdleInspection = new Set([
            "list_goals",
            "orchestrator_status",
            "get_plan",
          ]);
          toolsForInference = tools.filter(
            (tool) => !blockedIdleInspection.has(tool.name),
          );
        }
      }

      const inferenceTools = toolsToInferenceFormat(toolsForInference);
      const routerResult = await inferenceRouter.route(
`
);

console.log("[NOVENS CLOUD] Git dedupe + Daytona value execution patch applied.");