interface CodeBlockProps {
  code: string;
  language?: 'bash' | 'typescript' | 'javascript';
  size?: 'sm' | 'xs';
}

export function CodeBlock({code, language = 'typescript', size = 'sm'}: CodeBlockProps) {
  const colorClass = language === 'bash' ? 'text-green-400' : 'text-slate-300';
  const sizeClass = size === 'xs' ? 'text-xs' : 'text-sm';

  return (
    <pre className={`bg-slate-900 border border-slate-700 rounded p-4 overflow-x-auto ${sizeClass}`}>
      <code className={colorClass}>{code}</code>
    </pre>
  );
}
