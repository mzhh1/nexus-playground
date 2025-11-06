/**
 * LLM Player Template Selection Modal
 * Allows selecting from predefined LLM player templates
 */

import React, { useState } from 'react';
import llmTemplates from '../data/llm-player-templates.json';
import '../styles/modal.css';

export interface LLMPlayerTemplate {
  id: string;
  name: string;
  model_name: string;
  system_prompt: string;
}

interface LLMPlayerTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: LLMPlayerTemplate) => void;
}

export const LLMPlayerTemplateModal: React.FC<LLMPlayerTemplateModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<LLMPlayerTemplate | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  if (!isOpen) return null;

  const handleTemplateClick = (template: LLMPlayerTemplate) => {
    setSelectedTemplate(template);
    setShowPrompt(false);
  };

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
      setSelectedTemplate(null);
      setShowPrompt(false);
    }
  };

  const handleCancel = () => {
    setSelectedTemplate(null);
    setShowPrompt(false);
    onClose();
  };

  const templates = llmTemplates as LLMPlayerTemplate[];

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>选择 LLM 玩家模板</h2>
          <button className="modal-close" onClick={handleCancel}>×</button>
        </div>

        <div className="modal-body">
          <div className="template-list">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`template-item ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                onClick={() => handleTemplateClick(template)}
              >
                <div className="template-header">
                  <h3>{template.name}</h3>
                  <span className="template-model">{template.model_name}</span>
                </div>
                <p className="template-prompt">
                  {template.system_prompt.length > 100
                    ? `${template.system_prompt.substring(0, 100)}...`
                    : template.system_prompt}
                </p>
                {selectedTemplate?.id === template.id && (
                  <button
                    className="view-prompt-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPrompt(!showPrompt);
                    }}
                  >
                    {showPrompt ? '收起完整提示词' : '查看完整提示词'}
                  </button>
                )}
                {selectedTemplate?.id === template.id && showPrompt && (
                  <div className="full-prompt">
                    <strong>完整系统提示词：</strong>
                    <pre>{template.system_prompt}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={handleCancel} className="secondary">
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedTemplate}
            className="primary"
          >
            确认添加
          </button>
        </div>
      </div>
    </div>
  );
};

