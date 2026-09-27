import './ReportFormatModal.css'

/**
 * ReportFormatModal
 * Shown when an analyst clicks "Generate" — lets them choose CSV or PDF.
 */
function ReportFormatModal({ reportName, onSelect, onCancel }) {
    return (
        <div className="rfm-backdrop" onClick={onCancel}>
            <div className="rfm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Choose report format">
                <h2 className="rfm__title">Export report</h2>
                <p className="rfm__sub">{reportName}</p>

                <div className="rfm__options">
                    <button type="button" className="rfm__option" onClick={() => onSelect('csv')}>
                        <span className="rfm__icon">📄</span>
                        <strong>CSV</strong>
                        <span>Spreadsheet-compatible,<br />open in Excel or Sheets</span>
                    </button>

                    <button type="button" className="rfm__option" onClick={() => onSelect('pdf')}>
                        <span className="rfm__icon">🗂</span>
                        <strong>PDF</strong>
                        <span>Formatted document,<br />ready to share or print</span>
                    </button>
                </div>

                <button type="button" className="rfm__cancel" onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </div>
    )
}

export default ReportFormatModal
