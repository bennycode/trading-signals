interface HeroProps {
  title: string;
  description: string;
  npmUrl: string;
  githubUrl: string;
}

export function Hero({title, description, npmUrl, githubUrl}: HeroProps) {
  return (
    <div className="text-center space-y-4 py-12">
      <h1 className="text-5xl font-bold text-white">{title}</h1>
      <p className="text-xl text-slate-300 max-w-2xl mx-auto">{description}</p>
      <div className="flex justify-center gap-4 mt-8">
        <a
          href={npmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
          View on NPM
        </a>
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium">
          View on GitHub
        </a>
      </div>
    </div>
  );
}
