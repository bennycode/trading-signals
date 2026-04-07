import os from 'node:os';

export const health = async () => {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

  const cpus = os.cpus();
  const cpuAvg =
    cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

  const heapPercent = ((mem.heapUsed / mem.heapTotal) * 100).toFixed(1);
  const rssPercent = ((mem.rss / totalMem) * 100).toFixed(1);

  const lines = [
    `🖥 CPU Usage: ${cpuAvg.toFixed(1)}% (${cpus.length} cores)`,
    `💾 System RAM: ${memPercent}% (${formatBytes(usedMem)} / ${formatBytes(totalMem)})`,
    `📦 Process RSS: ${rssPercent}% (${formatBytes(mem.rss)} / ${formatBytes(totalMem)})`,
    `📦 Process Heap: ${heapPercent}% (${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)})`,
  ];

  return lines.join('\n');
};

function formatBytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}
