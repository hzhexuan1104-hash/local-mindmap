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
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {preserveStandaloneTripleAsterisks(content)}
      </ReactMarkdown>
    </div>
  );
}
