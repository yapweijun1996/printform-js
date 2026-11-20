import { expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

export async function launchOfflineWebKit(browserType,info) {
  const args = ['--user','--map-current-user','--net'];
  if (process.platform !== 'linux' || spawnSync('unshare',[...args,'--','true'],{stdio:'ignore',timeout:2000}).status !== 0) {
    info.annotations.push({type:'native-file-control',description:'Linux WebKit needs an available unprivileged network namespace for the offline file check.'});
    return null;
  }
  // Leave native file navigation enabled while disconnecting WebKit and its
  // subprocesses from the host network.
  const executablePath = info.outputPath('webkit-network-namespace');
  await writeFile(executablePath,`#!/bin/sh\nexec unshare ${args.join(' ')} -- "$PRINTFORM_E2E_WEBKIT_BINARY" "$@"\n`,{mode:0o700});
  return browserType.launch({executablePath,env:{...process.env,PRINTFORM_E2E_WEBKIT_BINARY:browserType.executablePath()}});
}

export async function expectOfflineStudioConnection(context,studioUrl,errorPattern = /could not connect|network is unreachable|connection refused/i) {
  // This same Studio server was reachable in the regular browser fixture. Do
  // not route or stub the separate canary page in the native offline context.
  const canary = await context.newPage();
  try {
    await expect(canary.goto(studioUrl,{waitUntil:'commit',timeout:5000})).rejects.toThrow(errorPattern);
  } finally { await canary.close(); }
}
