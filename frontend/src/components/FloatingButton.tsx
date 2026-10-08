export function FloatingButton({
  hidden,
  onClick,
}: {
  hidden: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`fab ${hidden ? "hidden" : ""}`}
      onClick={onClick}
      aria-label="打开对话"
    >
      <span className="fab-icon">💬</span>
      <span className="fab-label">和 CV_Bot 聊聊</span>
    </button>
  );
}