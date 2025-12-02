interface CodeBlockProps {
  code: string;
  language?: 'bash' | 'typescript' | 'javascript';
}

export function CodeBlock({code, language = 'typescript'}: CodeBlockProps) {
  const colorClass = language === 'bash' ? 'text-green-400' : 'text-slate-300';

  return (
    <pre className="bg-slate-900 border border-slate-700 rounded p-4 overflow-x-auto text-sm">
      <code className={colorClass}>{code}</code>
    </pre>
  );
}
