import React from "react";
import { Modal, Typography } from "antd";
import { isMultiphaseCategory } from "../features/multiphaseDetail";
import { useLocale } from "../i18n/LocaleContext";
import type { CaseDetailChartPayload } from "../types";
import { CaseLatencyChart } from "./CaseLatencyChart";
import { MultiphaseCaseDetail } from "./MultiphaseCaseDetail";

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
  const isMultiphase = payload ? isMultiphaseCategory(payload.category) : false;

  return (
    <Modal
      className="case-detail-chart-modal"
      open={open}
      onCancel={onClose}
      footer={null}
      width={isMultiphase ? 1040 : 820}
      centered
      destroyOnHidden
      title={isMultiphase ? t("multiphaseModalTitle") : t("detailLatencyModalTitle")}
    >
      {payload ? (
        <div className="case-detail-chart-modal-body">
          <div className="case-detail-chart-modal-header">
            <Typography.Text strong>{payload.case}</Typography.Text>
            <Typography.Text type="secondary">
              {payload.category} · {payload.categoryTitle}
              {isMultiphase ? " · Anchor → Public suite → Final" : ""}
            </Typography.Text>
          </div>
          {isMultiphase ? (
            <MultiphaseCaseDetail payload={payload} />
          ) : (
            <CaseLatencyChart payload={payload} />
          )}
        </div>
      ) : null}
    </Modal>
  );
};
