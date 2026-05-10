const examples = [
  "AI를 처음 써도 수강할 수 있나요?",
  "교육비는 무료인가요?",
  "노트북이 꼭 필요한가요?",
  "수업을 빠지면 어떻게 되나요?",
];

type ExampleQuestionsProps = {
  disabled: boolean;
  onSelect: (question: string) => void;
};

export function ExampleQuestions({ disabled, onSelect }: ExampleQuestionsProps) {
  return (
    <div className="example-section">
      <p className="section-label">예시 질문</p>
      <div className="example-grid">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(example)}
            className="example-button"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
