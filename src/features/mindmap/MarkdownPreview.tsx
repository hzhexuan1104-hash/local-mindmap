import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { preserveStandaloneTripleAsterisks } from './remarkMarkdown';

type MarkdownPreviewProps = {
  content: string;
};

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  if (!content.trim()) {
    return <div className="remark-empty">暂无备注</div>;
  }

  return (
    <div
      className="markdown-preview"
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Preserve author-entered soft breaks inside ordinary paragraphs without
          // changing Markdown block semantics for lists, tables, or code fences.
          p: ({ children }) => (
            <p className="markdown-paragraph-with-soft-breaks">{children}</p>
          ),
        }}
      >
        {preserveStandaloneTripleAsterisks(content)}
      </ReactMarkdown>
    </div>
  );
}
