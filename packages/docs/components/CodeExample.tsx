interface CodeExampleProps {
  title?: string;
  code: string;
  language?: string;
}

export function CodeExample({title = 'Code Example', code, language = 'typescript'}: CodeExampleProps) {
  return (
    <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-purple-400 mb-2">{title}</h3>
      <pre className="text-slate-300 text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
