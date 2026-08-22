interface CodeBlockProps {
  code: string;
  language?: 'bash' | 'typescript' | 'javascript';
  size?: 'sm' | 'xs';
}

export function CodeBlock({code, language = 'typescript', size = 'sm'}: CodeBlockProps) {
  const colorClass = language === 'bash' ? 'text-green-400' : 'demo-text';
  const sizeClass = size === 'xs' ? 'text-xs' : 'text-sm';

  return (
    <pre className={`demo-card overflow-x-auto ${sizeClass}`}>
      <code className={colorClass}>{code}</code>
    </pre>
  );
}
