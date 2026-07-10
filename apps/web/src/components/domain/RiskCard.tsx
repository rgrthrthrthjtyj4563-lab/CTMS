import { Zap } from "lucide-react";
import { Card } from "../ui/Card.js";
import { RiskTag } from "./RiskTag.js";
import {
  RISK_VISUAL,
  type RiskLevel,
  type RiskWorkflowStatus,
  RISK_WORKFLOW_LABEL,
  RISK_WORKFLOW_VISUAL,
} from "../../domain/types.js";

export interface RiskCardItem {
  id: string;
  level: RiskLevel;
  type: string;
  object: string;
  trigger: string;
  suggestion: string;
  owner: string;
  deadline: string;
  status: RiskWorkflowStatus;
}

export interface RiskCardProps {
  item: RiskCardItem;
  onAction?: (item: RiskCardItem) => void;
}

/**
 * RiskCard extracted from the prototype. Surfaces a single risk item
 * with the AI suggestion (always labelled), the responsible owner, and
 * a coloured left border indicating risk level.
 */
export function RiskCard({ item, onAction }: RiskCardProps) {
  const c = RISK_VISUAL[item.level];
  const statusVisual = RISK_WORKFLOW_VISUAL[item.status];
  return (
    <Card
      riskAccent={item.level}
      onClick={onAction ? () => onAction(item) : undefined}
      className={onAction ? "cursor-pointer hover:bg-slate-50" : ""}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <RiskTag level={item.level} />
          <span className="text-sm font-medium text-slate-700">{item.type}</span>
        </div>
        <span className="text-xs text-slate-400">{item.deadline}</span>
      </div>
      <div className="text-xs text-slate-500 mb-2">
        <span className="font-medium text-slate-600">{item.object}</span>
        {" · "}
        {item.trigger}
      </div>
      <div
        className="flex items-center gap-2 p-2 rounded-md text-xs"
        style={{ background: "#f5f3ff", color: "#5b21b6" }}
      >
        <Zap className="w-3 h-3 flex-shrink-0" />
        <span>{item.suggestion}</span>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-slate-400">
          责任人：<span className="text-slate-600">{item.owner}</span>
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: statusVisual.bg, color: statusVisual.text }}
        >
          {RISK_WORKFLOW_LABEL[item.status]}
        </span>
      </div>
    </Card>
  );
}
