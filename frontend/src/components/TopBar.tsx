import { exportSession, deleteSession } from "../api";

export function TopBar({
  sessionId,
  onClear,
}: {
  sessionId: string;
  onClear: () => void;
}) {
  const onExport = () => exportSession(sessionId);

  const onDelete = async () => {
    if (!confirm("删除本次会话的全部记录？此操作不可恢复。")) return;
    await deleteSession(sessionId);
    await onClear();
  };

  return (
    <div className="top-bar">
      <div className="brand">
        <span className="dot" />
        CV_Bot · 简历机器人
      </div>
      <div className="actions">
        <button className="btn btn-ghost" onClick={onExport}>
          导出
        </button>
        <button className="btn btn-ghost" onClick={onClear}>
          新会话
        </button>
        <button className="btn btn-danger" onClick={onDelete}>
          删除
        </button>
      </div>
    </div>
  );
}