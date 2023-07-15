import { NS } from "@ns";
import { deployScript } from "../lib/scripts-helper";
import { findServers } from "/lib/server-helper";

export async function main(ns: NS) {
  const script: string = String(ns.args[0]);
  const target: string = String(ns.args[1]);
  const filter: string = String(ns.args[2]);
  const recursive: boolean = Boolean(ns.args[3]);

  const servers: Set<string> = await findServers(ns, target, filter, recursive);
  deployScripts(ns, script, servers);
}

/** 
 * Deploys and executes the provided script 
 * @param {NS} ns - Netscript library
 */
/** @param {NS} ns */
export async function deployScripts(ns: NS, script: string, servers: Set<string> | string[]) {
  // Deploy script on all server found
  for (let server of servers) {
    initServer(ns, server);
    await deployScript(ns, ns.getServer(server), script);
  }
}

async function initServer(ns: NS, target: string) {
  if (ns.fileExists("BruteSSH.exe", "home")) {
      await ns.brutessh(target);
  }

  await ns.nuke(target);
}