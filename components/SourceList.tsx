import type { ChatSource } from "@/types/chat";

type SourceListProps = {
  sources: ChatSource[];
};

export function SourceList({ sources }: SourceListProps) {
  return (
    <div className="source-box">
      <p className="source-title">참고 FAQ / 출처</p>
      <ul className="source-list">
        {sources.map((source) => (
          <li
            key={source.id}
            className="source-item"
          >
            <span className="source-question">{source.question}</span>
            <span>
              {source.category ? `분류: ${source.category}` : "분류 없음"}
            </span>
            <span>유사도 {Math.round(source.similarity * 100)}%</span>
            {source.sourceUrl ? (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="source-link"
              >
                출처 보기
              </a>
            ) : source.source ? (
              <span>출처: {source.source}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
