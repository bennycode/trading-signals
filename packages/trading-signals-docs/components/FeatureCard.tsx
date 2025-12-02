interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

export function FeatureCard({icon, title, description}: FeatureCardProps) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}
