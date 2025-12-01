import Link from 'next/link';

interface CategoryCardProps {
  name: string;
  description: string;
  href: string;
  icon: string;
  indicators: string[];
}

export function CategoryCard({name, description, href, icon, indicators}: CategoryCardProps) {
  return (
    <Link
      href={href}
      className="group block bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-slate-500 transition-all hover:shadow-lg hover:shadow-slate-700/50">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{icon}</span>
        <h3 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">{name}</h3>
      </div>
      <p className="text-slate-400 text-sm mb-4">{description}</p>
      <div className="flex flex-wrap gap-2">
        {indicators.slice(0, 4).map(indicator => (
          <span key={indicator} className="px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded font-mono">
            {indicator}
          </span>
        ))}
        {indicators.length > 4 && (
          <span className="px-2 py-1 text-slate-400 text-xs">+{indicators.length - 4} more</span>
        )}
      </div>
      <div className="mt-4 text-blue-400 text-sm font-medium group-hover:underline">View indicators →</div>
    </Link>
  );
}
