import './ReportFormatModal.css'
import { getCurrentUser } from '../api.js'
import { PrinterIcon, DownloadIcon, FileTextIcon } from './icons.jsx'

/**
 * ReportFormatModal
 * Shown when an analyst clicks "Generate" or "Print" — lets them choose Print, PDF, or CSV
 * and shows the name of the user who will be attributed on the document.
 */
function ReportFormatModal({ reportName, user, onSelect, onCancel }) {
    const activeUser = user || getCurrentUser()

    return (
        <div className="rfm-backdrop" onClick={onCancel}>
            <div
                className="rfm"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Choose report format and print options"
            >
                <div className="rfm__header">
                    <h2 className="rfm__title">Print &amp; Export Report</h2>
                    <p className="rfm__sub">{reportName}</p>
                </div>

                <div className="rfm__attestation">
                    <div className="rfm__attestation-text">
                        <span className="rfm__attestation-label">Attributed To:</span>
                        <strong className="rfm__attestation-name">{activeUser.name}</strong>
                        <span className="rfm__attestation-role">({activeUser.role || 'Analyst'})</span>
                    </div>
                </div>

                <div className="rfm__options">
                    <button
                        type="button"
                        className="rfm__option rfm__option--print"
                        onClick={() => onSelect('print')}
                    >
                        <span className="rfm__icon"><PrinterIcon width={24} height={24} /></span>
                        <strong>Print</strong>
                        <span>Direct print layout with print dialog</span>
                    </button>

                    <button
                        type="button"
                        className="rfm__option rfm__option--pdf"
                        onClick={() => onSelect('pdf')}
                    >
                        <span className="rfm__icon"><DownloadIcon width={24} height={24} /></span>
                        <strong>PDF</strong>
                        <span>Formatted document with page numbers</span>
                    </button>

                    <button
                        type="button"
                        className="rfm__option rfm__option--csv"
                        onClick={() => onSelect('csv')}
                    >
                        <span className="rfm__icon"><FileTextIcon width={24} height={24} /></span>
                        <strong>CSV</strong>
                        <span>Spreadsheet data with audit header</span>
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
