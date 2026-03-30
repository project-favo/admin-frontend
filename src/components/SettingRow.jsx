const SettingRow = ({ label, value, children }) => {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      <div className="settings-row-control">
        {children ?? (value != null ? <span className="settings-row-value">{value}</span> : null)}
      </div>
    </div>
  );
};

export default SettingRow;
