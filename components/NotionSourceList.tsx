import type { NotionSource } from "@/types/notion";

type NotionSourceListProps = {
  sources: NotionSource[];
};

export function NotionSourceList({ sources }: NotionSourceListProps) {
  const unique = sources.filter(
    (s, i, arr) => arr.findIndex((x) => x.pageId === s.pageId) === i,
  );

  return (
    <div className="source-box">
      <p className="source-title">참고 교육 자료 / 출처</p>
      <ul className="source-list">
        {unique.map((source) => (
          <li key={`${source.pageId}-${source.chunkIndex}`} className="source-item">
            {source.pageUrl ? (
              <a
                href={source.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="source-link"
              >
                {source.pageTitle}
              </a>
            ) : (
              <span className="source-question">{source.pageTitle}</span>
            )}
            <span className="source-preview">{source.contentPreview}…</span>
            <span>유사도 {Math.round(source.similarity * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
