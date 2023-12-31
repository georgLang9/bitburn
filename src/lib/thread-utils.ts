import { NS } from "@ns";
import { Controller } from "/hacking/controller";
import { clamp } from "/lib/misc";
import { Target } from "/hacking/target";
import { Metrics } from "/hacking/metrics";
import { hackingScripts } from "/scripts/Scripts";

export function calculateThreads(ns: NS, metrics: Metrics): number[] {
  const hackThreads = getHackThreads(ns, metrics);
  const hackWeakenThreads = Math.ceil(hackThreads / 25); // 1x weaken == 25x hacks
  const growThreads = Math.floor(
    growthAnalyzeDynamic(ns, metrics.target, 1 + metrics.greed),
  );
  const growWeakenThreads = Math.ceil(growThreads / 12.5); // 1x grow == 12.5x hacks

  const threads: number[] = [
    hackThreads,
    hackWeakenThreads,
    growThreads,
    growWeakenThreads,
  ];
  return threads;
}

// Returns the amount of threads necessary,
// to grow money to maximum on a provided target
export function getHackThreads(ns: NS, metrics: Metrics): number {
  let hackPercent = 0;
  // If formulas is available use it. Otherwise use less effective alternative
  if (ns.fileExists("Formulas.exe", "home")) {
    // Info required for formulas
    const player = ns.getPlayer();
    const server = metrics.target.server;

    hackPercent = ns.formulas.hacking.hackPercent(server, player);
  } else {
    hackPercent = getHackEffect(ns, metrics.target);
  }

  // Threads need to be whole a number
  const hackThreads = Math.floor(metrics.greed / hackPercent);

  return hackThreads;
}

// Calculates the percent of money stolen by hack in decimal form,
// based on a provided target
// Algorith based on ingame Algorithm, linked below:
// https://github.com/bitburner-official/bitburner-src/blob/dev/src/Hacking.ts
function getHackEffect(ns: NS, target: Target): number {
  const hostname = target.server.hostname;

  const hackDifficulty = target.hackDifficulty;
  const difficultyMultiplier = (100 - hackDifficulty) / 100;

  const hackStealMultiplier = ns.getPlayer().mults.hacking_money;

  const playerSkill = ns.getPlayer().skills.hacking;
  const requiredSkill = ns.getServerRequiredHackingLevel(hostname);
  const skillMultiplier = (playerSkill - (requiredSkill - 1)) / playerSkill;

  const balanceFactor = 240;
  const percentMoneyStolen =
    (difficultyMultiplier * skillMultiplier * hackStealMultiplier) /
    balanceFactor;

  return clamp(percentMoneyStolen, 0, 1);
}

// Returns the amount of threads necessary,
// to grow money to maximum on a provided target
export function getGrowThreads(ns: NS, target: Target): number {
  const maxMoney = target.moneyMax;
  const money = target.moneyAvailable;

  let growThreads = 0;
  if (ns.fileExists("Formulas.exe")) {
    const predictedServer = createMockServer(ns, target);
    growThreads = ns.formulas.hacking.growThreads(
      predictedServer,
      ns.getPlayer(),
      maxMoney,
    );
  } else {
    const multiplier = maxMoney / Math.max(money, 1);
    growThreads = growthAnalyzeDynamic(ns, target, multiplier);
  }
  growThreads = Math.ceil(growThreads);

  return growThreads; // Only whole threads exist
}

// Creates a fake server based on provided target stats
function createMockServer(ns: NS, target: Target) {
  let mockServer = ns.formulas.mockServer();
  mockServer = target.server;

  // Use predicted money and security values, not current ones
  const money = target.moneyAvailable;
  const sec = target.hackDifficulty;
  mockServer.moneyAvailable = money;
  mockServer.hackDifficulty = sec;

  return mockServer;
}

// Calculates growth threads based on provided target
// Read source code for exact formula:
// https://github.com/bitburner-official/bitburner-src/blob/dev/src/Server/ServerHelpers.ts#L6
function growthAnalyzeDynamic(
  ns: NS,
  target: Target,
  multiplier: number,
): number {
  const hostname = target.server.hostname;
  const hackDifficulty = ns.getServerSecurityLevel(hostname);
  const baseGrowthRate = 1.003;

  let adjustedGrowthRate = 1 + (baseGrowthRate - 1) / hackDifficulty;
  adjustedGrowthRate = Math.min(adjustedGrowthRate, 1.0035);

  const serverGrowthPercent = ns.getServerGrowth(hostname) / 100;

  const growMultiplier = ns.getPlayer().mults.hacking_grow;
  const threads =
    Math.log(multiplier) /
    (Math.log(adjustedGrowthRate) * growMultiplier * serverGrowthPercent);
  return threads;
}

export function calculateDelays(ns: NS, controller: Controller): number[] {
  // Get hostname of target
  const target = controller.metrics.target.server.hostname;

  // Timings are the basis for delay calculation
  const hackTime = ns.getHackTime(target);
  const growTime = ns.getGrowTime(target);
  const weakenTime = ns.getWeakenTime(target);

  // Calculate delay based on weaken1
  //  H:    =     => W - H - S
  // W1: =====    => 0
  //  G:   ====   => W - G + S
  // W2:   =====  => S * 2
  const taskDelay = controller.metrics.taskDelay;
  const hackDelay = weakenTime - hackTime - taskDelay;
  const weaken1Delay = 0;
  const growDelay = weakenTime - growTime + taskDelay;
  const weaken2Delay = taskDelay * 2;

  const delays: number[] = [hackDelay, weaken1Delay, growDelay, weaken2Delay];

  return delays;
}

/**
 * Calculates the amount of threads necessary,
 * to reduce security to the minimum on a target
 * @param ns - Netscript functions
 * @param target - The where security should be weakened
 * @returns Amount of threads necessary to reduce security to the minimum
 */
export function getMinSecThreads(ns: NS, target: Target): number {
  const hostname = target.server.hostname;
  const minSec = ns.getServerMinSecurityLevel(hostname);
  const sec = target.hackDifficulty;
  const weakenEffect = ns.weakenAnalyze(1);

  const weakenThreads = Math.abs(sec - minSec) / weakenEffect;
  return Math.ceil(weakenThreads); // Only whole threads exist
}
