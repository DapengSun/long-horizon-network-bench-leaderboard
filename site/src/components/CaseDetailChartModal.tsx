import React from "react";
import { Modal, Typography } from "antd";
import { useLocale } from "../i18n/LocaleContext";
import type { CaseDetailChartPayload } from "../types";
import { CaseLatencyChart } from "./CaseLatencyChart";

interface CaseDetailChartModalProps {
  open: boolean;
  payload: CaseDetailChartPayload | null;
  onClose: () => void;
}

export const CaseDetailChartModal: React.FC<CaseDetailChartModalProps> = ({
  open,
  payload,
  onClose,
}) => {
  const { t } = useLocale();

  return (
    <Modal
      className="case-detail-chart-modal"
      open={open}
      onCancel={onClose}
      footer={null}
      width={820}
      destroyOnHidden
      title={t("detailLatencyModalTitle")}
    >
      {payload ? (
        <div className="case-detail-chart-modal-body">
          <div className="case-detail-chart-modal-header">
            <Typography.Text strong>{payload.case}</Typography.Text>
            <Typography.Text type="secondary">
              {payload.category} · {payload.categoryTitle}
            </Typography.Text>
          </div>
          <CaseLatencyChart payload={payload} />
        </div>
      ) : null}
    </Modal>
  );
};
