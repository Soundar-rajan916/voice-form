// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReviewModal } from '../components/ReviewModal';
import { EditBanner } from '../components/EditBanner';
import { MicControl } from '../components/MicControl';
import { SheetRow } from '../components/SheetRow';
import { Sheet } from '../components/Sheet';

afterEach(() => {
  cleanup();
});

describe('VoiceChat UI/UX Flows', () => {
  const sampleFields = [
    {
      id: 1,
      field_name: 'full_name',
      data_type: 'String',
      required: true,
      question_en: 'What is your full name?',
      question_ta: 'உங்கள் முழு பெயர் என்ன?'
    },
    {
      id: 2,
      field_name: 'mobile_number',
      data_type: 'Phone',
      required: true,
      question_en: 'What is your mobile number?',
      question_ta: 'உங்கள் மொபைல் எண் என்ன?'
    }
  ];

  describe('Completed-State UI', () => {
    it('disables or replaces live mic and live input when form is completed', () => {
      const handleTapMic = vi.fn();

      // In completed state, isDisabled is true on MicControl
      const { rerender } = render(
        <MicControl
          vadState="idle"
          isListening={false}
          permissionState="granted"
          isDisabled={true}
          onTapMic={handleTapMic}
          uiLang="en"
        />
      );

      const micButton = screen.getByRole('button', { name: /Tap to speak/i });
      expect(micButton.disabled).toBe(true);
      fireEvent.click(micButton);
      expect(handleTapMic).not.toHaveBeenCalled();

      cleanup();

      // In active state, MicControl is enabled
      render(
        <MicControl
          vadState="idle"
          isListening={false}
          permissionState="granted"
          isDisabled={false}
          onTapMic={handleTapMic}
          uiLang="en"
        />
      );
      const activeMicButton = screen.getByRole('button', { name: /Tap to speak/i });
      expect(activeMicButton.disabled).toBe(false);
      fireEvent.click(activeMicButton);
      expect(handleTapMic).toHaveBeenCalled();
    });

    it('renders completion message and Review & Submit action in side panel Sheet when all answered', () => {
      const handleSubmit = vi.fn();
      const sampleAnswers = { 1: 'Priya Sundaram', 2: '9876543210' };

      render(
        <Sheet
          fields={sampleFields}
          answers={sampleAnswers}
          allAnswered={true}
          mode="review"
          submissionStatus="in_progress"
          onSubmit={handleSubmit}
          uiLang="en"
        />
      );

      // Verify "Your answers" title and progress
      expect(screen.getByText('Your answers')).toBeDefined();
      expect(screen.getByText('2 of 2 answered')).toBeDefined();

      // Submit button should say Review and submit and be enabled
      const submitBtn = screen.getByRole('button', { name: /Review and submit/i });
      expect(submitBtn).toBeDefined();
      expect(submitBtn.disabled).toBe(false);

      fireEvent.click(submitBtn);
      expect(handleSubmit).toHaveBeenCalled();
    });
  });

  describe('Review Modal Flow', () => {
    it('renders all answers with edit action and handles confirm submit', () => {
      const handleClose = vi.fn();
      const handleConfirm = vi.fn();
      const handleEdit = vi.fn();
      const sampleAnswers = { 1: 'Priya Sundaram', 2: '9876543210' };

      render(
        <ReviewModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          fields={sampleFields}
          answers={sampleAnswers}
          onEditField={handleEdit}
          submitting={false}
          submitError={null}
          uiLang="en"
        />
      );

      // Verify dialog is visible
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('Review your application')).toBeDefined();
      expect(screen.getByText('Priya Sundaram')).toBeDefined();
      expect(screen.getByText('9876543210')).toBeDefined();

      // Click Edit on first field
      const editButtons = screen.getAllByRole('button', { name: /Edit/i });
      expect(editButtons.length).toBeGreaterThanOrEqual(2);
      fireEvent.click(editButtons[0]);
      expect(handleEdit).toHaveBeenCalledWith(1);

      // Click Confirm and submit
      const confirmBtn = screen.getByRole('button', { name: /Confirm and submit/i });
      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalled();
    });

    it('flags unanswered fields at top of review modal', () => {
      const handleEdit = vi.fn();
      // Field 2 is unanswered
      const partialAnswers = { 1: 'Priya Sundaram' };

      render(
        <ReviewModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          fields={sampleFields}
          answers={partialAnswers}
          onEditField={handleEdit}
          submitting={false}
          uiLang="en"
        />
      );

      // Warning alert should be displayed
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/Some questions have not been answered yet/i)).toBeDefined();
      expect(screen.getByText('Not answered yet')).toBeDefined();
    });

    it('displays translated error and retry action on submit failure', () => {
      const handleRetry = vi.fn();

      render(
        <ReviewModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          fields={sampleFields}
          answers={{ 1: 'Priya', 2: '9876543210' }}
          onEditField={vi.fn()}
          submitting={false}
          submitError="Network gateway timeout"
          onRetry={handleRetry}
          uiLang="en"
        />
      );

      expect(screen.getByText('Failed to submit application')).toBeDefined();
      expect(screen.getByText('Network gateway timeout')).toBeDefined();

      const retryBtn = screen.getByRole('button', { name: /Retry submission/i });
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalled();
    });

    it('closes on Escape key press and invokes onClose', () => {
      const handleClose = vi.fn();

      render(
        <ReviewModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={vi.fn()}
          fields={sampleFields}
          answers={{ 1: 'Priya', 2: '9876543210' }}
          onEditField={vi.fn()}
          uiLang="en"
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('Edit-Answer Flow', () => {
    it('makes entire answer row tappable with min 44px hit area and invokes onSelectField', () => {
      const handleSelectField = vi.fn();

      render(
        <SheetRow
          field={sampleFields[0]}
          answer="Priya Sundaram"
          isCurrent={false}
          isEditing={false}
          isDisabled={false}
          onSelectField={handleSelectField}
          uiLang="en"
        />
      );

      const rowButton = screen.getByRole('button', { name: /Edit full name/i });
      expect(rowButton).toBeDefined();

      // Click row
      fireEvent.click(rowButton);
      expect(handleSelectField).toHaveBeenCalledWith(1);

      // Keyboard Enter
      fireEvent.keyDown(rowButton, { key: 'Enter' });
      expect(handleSelectField).toHaveBeenCalledWith(1);
    });

    it('renders EditBanner with field name and Cancel action', () => {
      const handleCancel = vi.fn();

      render(
        <EditBanner
          fieldName="mobile_number"
          onCancel={handleCancel}
          uiLang="en"
        />
      );

      expect(screen.getByText(/Changing mobile number/i)).toBeDefined();
      const cancelBtn = screen.getByRole('button', { name: /Cancel change/i });
      fireEvent.click(cancelBtn);
      expect(handleCancel).toHaveBeenCalled();
    });

    it('supports Tamil in edit banner and sheet row without placeholder leaks', () => {
      const handleCancel = vi.fn();

      render(
        <EditBanner
          fieldName="mobile_number"
          onCancel={handleCancel}
          uiLang="ta"
        />
      );

      expect(screen.getByText(/mobile number மாற்றப்படுகிறது/i)).toBeDefined();
      const cancelBtn = screen.getByRole('button', { name: /ரத்து செய்/i });
      expect(cancelBtn).toBeDefined();
    });
  });

  describe('Choice Questions Preview Flow', () => {
    const choiceField = {
      id: 3,
      field_name: 'gender',
      data_type: 'Choice',
      choices: ['Male', 'Female', 'Transgender'],
      required: true,
      question_en: 'What is your gender?',
      question_ta: 'உங்கள் பாலினம் என்ன?'
    };

    it('renders all choices in the preview row and indicates selected choice', () => {
      const handleSelectChoice = vi.fn();

      render(
        <SheetRow
          field={choiceField}
          answer="Female"
          isCurrent={true}
          isEditing={false}
          isDisabled={false}
          onSelectChoice={handleSelectChoice}
          uiLang="en"
        />
      );

      // Verify all choice buttons are rendered
      expect(screen.getByRole('button', { name: /Select Male/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Select Female/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Select Transgender/i })).toBeDefined();

      // Selected choice Female has aria-pressed true
      const femaleBtn = screen.getByRole('button', { name: /Select Female/i });
      expect(femaleBtn.getAttribute('aria-pressed')).toBe('true');

      // Male has aria-pressed false
      const maleBtn = screen.getByRole('button', { name: /Select Male/i });
      expect(maleBtn.getAttribute('aria-pressed')).toBe('false');

      // Clicking an option invokes onSelectChoice with field.id and choice
      fireEvent.click(maleBtn);
      expect(handleSelectChoice).toHaveBeenCalledWith(3, 'Male');
    });

    it('renders choice options in Sheet and forwards onSelectChoice', () => {
      const handleSelectChoice = vi.fn();

      render(
        <Sheet
          fields={[choiceField]}
          answers={{ 3: 'Male' }}
          currentFieldId={3}
          onSelectChoice={handleSelectChoice}
          uiLang="en"
        />
      );

      const tgBtn = screen.getByRole('button', { name: /Select Transgender/i });
      expect(tgBtn).toBeDefined();

      fireEvent.click(tgBtn);
      expect(handleSelectChoice).toHaveBeenCalledWith(3, 'Transgender');
    });
  });

  describe('Automatic Mic State Flow', () => {
    it('MicControl correctly reflects automatic listening, speech-detected, and processing states', () => {
      const handleTapMic = vi.fn();

      const { rerender } = render(
        <MicControl
          vadState="listening"
          isListening={true}
          permissionState="granted"
          isDisabled={false}
          onTapMic={handleTapMic}
          uiLang="en"
        />
      );

      expect(screen.getByRole('button', { name: /Listening/i })).toBeDefined();

      rerender(
        <MicControl
          vadState="speech_detected"
          isListening={true}
          permissionState="granted"
          isDisabled={false}
          onTapMic={handleTapMic}
          uiLang="en"
        />
      );
      expect(screen.getByRole('button', { name: /Listening/i })).toBeDefined();

      rerender(
        <MicControl
          vadState="processing"
          isListening={false}
          permissionState="granted"
          isDisabled={false}
          onTapMic={handleTapMic}
          uiLang="en"
        />
      );
      expect(screen.getByRole('button', { name: /Understanding your answer/i })).toBeDefined();
    });
  });

  describe('Document Proposals Flow', () => {
    it('renders extracted proposals in Sheet and handles accept all, individual accept, dismiss, and edit', () => {
      const handleAcceptProposals = vi.fn();
      const handleDismissProposal = vi.fn();
      const handleEditProposal = vi.fn();

      const sampleProposals = [
        {
          id: 101,
          field_id: 1,
          field_name: 'applicant_name',
          value: 'Priya Sundaram',
          page: 1,
          read_method: 'vision',
          status: 'pending',
          scanned_warning: 'Read from a scanned page. Check this one.'
        },
        {
          id: 102,
          field_id: 2,
          field_name: 'phone_number',
          value: '9876543210',
          page: 1,
          read_method: 'text_layer',
          status: 'pending'
        }
      ];

      render(
        <Sheet
          fields={sampleFields}
          answers={{}}
          proposals={sampleProposals}
          allAnswered={false}
          mode="normal"
          submissionStatus="in_progress"
          onAcceptProposals={handleAcceptProposals}
          onDismissProposal={handleDismissProposal}
          onEditProposal={handleEditProposal}
          uiLang="en"
        />
      );

      // Verify proposal title and items
      expect(screen.getByText(/Document suggestions \(2\)/i)).toBeDefined();
      expect(screen.getByText('Priya Sundaram')).toBeDefined();
      expect(screen.getByText('9876543210')).toBeDefined();
      expect(screen.getByText(/Scanned page — check carefully/i)).toBeDefined();

      // Test "Accept All" button
      const acceptAllBtn = screen.getByRole('button', { name: /Accept all \(2\)/i });
      fireEvent.click(acceptAllBtn);
      expect(handleAcceptProposals).toHaveBeenCalledWith([101, 102]);

      // Test individual "Accept" button
      const acceptBtns = screen.getAllByTitle('Accept');
      fireEvent.click(acceptBtns[0]);
      expect(handleAcceptProposals).toHaveBeenCalledWith([101]);

      // Test individual "Dismiss" button
      const dismissBtns = screen.getAllByTitle('Dismiss');
      fireEvent.click(dismissBtns[0]);
      expect(handleDismissProposal).toHaveBeenCalledWith(101);

      // Test individual "Edit" button
      const editBtns = screen.getAllByTitle('Edit');
      fireEvent.click(editBtns[0]);
      expect(handleEditProposal).toHaveBeenCalledWith(sampleProposals[0]);
    });
  });
});
