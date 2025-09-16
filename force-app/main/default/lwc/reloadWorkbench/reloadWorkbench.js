import { LightningElement, track, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { refreshApex } from "@salesforce/apex";

import fetchBatches from "@salesforce/apex/ReloadWorkspaceController.fetchBatches";
import fetchStagingRecords from "@salesforce/apex/ReloadWorkspaceController.fetchStagingRecords";
import fetchFieldValues from "@salesforce/apex/ReloadWorkspaceController.fetchFieldValues";
import searchTargetObjects from "@salesforce/apex/ReloadWorkspaceController.searchTargetObjects";
import touchBatch from "@salesforce/apex/ReloadWorkspaceController.touchBatch";

import TARGET_OBJECT_FIELD from "@salesforce/schema/Reload_Batch__c.Target_Object_API__c";
import DEFAULT_OPERATION_FIELD from "@salesforce/schema/Reload_Batch__c.Default_Operation__c";
import SOURCE_TYPE_FIELD from "@salesforce/schema/Reload_Batch__c.Source_Type__c";
import SOURCE_LOCATION_FIELD from "@salesforce/schema/Reload_Batch__c.Source_Location__c";
import EXTERNAL_SYSTEM_FIELD from "@salesforce/schema/Reload_Batch__c.External_System__c";
import NOTES_FIELD from "@salesforce/schema/Reload_Batch__c.Notes__c";

const DEFAULT_BATCH_LIMIT = 50;
const TARGET_LOOKUP_SEARCH_LIMIT = 20;
const TARGET_OBJECT_LABEL = "Target Object API Name";
const TARGET_LOOKUP_PLACEHOLDER = "Cerca un objecte de Salesforce";
const TARGET_LOOKUP_REQUIRED_MESSAGE = "Selecciona un objecte de destinació.";
const TARGET_LOOKUP_SPINNER_TEXT = "Carregant objectes";
const TARGET_LOOKUP_INPUT_ID = "target-object-lookup";
const TARGET_LOOKUP_LISTBOX_ID = `${TARGET_LOOKUP_INPUT_ID}-listbox`;
const TARGET_LOOKUP_LABEL_ID = `${TARGET_LOOKUP_INPUT_ID}-label`;
const TARGET_LOOKUP_LISTBOX_LABEL_ID = `${TARGET_LOOKUP_INPUT_ID}-listbox-label`;
const TARGET_LOOKUP_ASSISTIVE_TEXT_ID = `${TARGET_LOOKUP_INPUT_ID}-assistive`;
const TARGET_LOOKUP_ASSISTIVE_TEXT =
  "Utilitza les fletxes per navegar pels resultats i prem Retorn per seleccionar.";
const TARGET_LOOKUP_RESULTS_LABEL = "Resultats de la cerca";
const TARGET_LOOKUP_SELECTION_LABEL = "Objecte de destinació seleccionat";

export default class ReloadWorkbench extends LightningElement {
  @track batches;
  batchesError;
  wiredBatchesResult;

  @track stagingRecords;
  stagingError;
  stagingLoading = false;

  @track fieldValues;
  fieldValueError;
  fieldValuesLoading = false;

  @track targetLookupOptions = [];
  @track targetObjectSelection;

  targetObjectApi;
  targetLookupSearchTerm = "";
  targetLookupFocused = false;
  targetLookupDropdownOpen = false;
  targetLookupLoading = false;
  targetLookupErrorMessage;
  targetLookupSearchError;
  latestTargetLookupRequest = 0;
  targetLookupHighlightedIndex = -1;

  selectedBatchId;
  selectedStagingId;
  formSubmitRequested = false;

  acceptedFormats = [".csv"];

  batchColumns = [
    { label: "Batch", fieldName: "Name", type: "text" },
    { label: "Target Object", fieldName: "Target_Object_API__c", type: "text" },
    { label: "Operation", fieldName: "Default_Operation__c", type: "text" },
    { label: "Status", fieldName: "Status__c", type: "text" },
    { label: "Source Type", fieldName: "Source_Type__c", type: "text" },
    { label: "Source Location", fieldName: "Source_Location__c", type: "text" },
    { label: "Total", fieldName: "Total_Records__c", type: "number" },
    { label: "Processed", fieldName: "Processed_Records__c", type: "number" },
    { label: "Errors", fieldName: "Error_Count__c", type: "number" },
    { label: "Last Run", fieldName: "Last_Run__c", type: "date" }
  ];

  stagingColumns = [
    { label: "Staging Record", fieldName: "Name", type: "text" },
    { label: "Row", fieldName: "Source_Row_Number__c", type: "number" },
    { label: "Action", fieldName: "Record_Action__c", type: "text" },
    { label: "Status", fieldName: "Status__c", type: "text" },
    { label: "Field Count", fieldName: "Field_Count__c", type: "number" },
    { label: "Origin", fieldName: "Origin_Type__c", type: "text" },
    {
      label: "Source Reference",
      fieldName: "Source_Reference__c",
      type: "text"
    }
  ];

  fieldColumns = [
    { label: "Label", fieldName: "Field_Label__c", type: "text" },
    { label: "API Name", fieldName: "Field_API_Name__c", type: "text" },
    { label: "Type", fieldName: "Field_Type__c", type: "text" },
    {
      label: "Value",
      fieldName: "Field_Value__c",
      type: "text",
      wrapText: true
    },
    { label: "Sequence", fieldName: "Sequence__c", type: "number" },
    { label: "Is Key", fieldName: "Is_Key__c", type: "boolean" }
  ];

  get targetObjectField() {
    return TARGET_OBJECT_FIELD.fieldApiName;
  }

  get targetObjectFieldLabel() {
    return TARGET_OBJECT_LABEL;
  }

  get targetLookupPlaceholder() {
    return TARGET_LOOKUP_PLACEHOLDER;
  }

  get targetLookupSpinnerText() {
    return TARGET_LOOKUP_SPINNER_TEXT;
  }

  get targetLookupInputId() {
    return TARGET_LOOKUP_INPUT_ID;
  }

  get targetLookupListboxId() {
    return TARGET_LOOKUP_LISTBOX_ID;
  }

  get targetLookupLabelId() {
    return TARGET_LOOKUP_LABEL_ID;
  }

  get targetLookupListboxLabelId() {
    return TARGET_LOOKUP_LISTBOX_LABEL_ID;
  }

  get targetLookupAssistiveTextId() {
    return TARGET_LOOKUP_ASSISTIVE_TEXT_ID;
  }

  get targetLookupAssistiveText() {
    return TARGET_LOOKUP_ASSISTIVE_TEXT;
  }

  get targetLookupResultsLabel() {
    return TARGET_LOOKUP_RESULTS_LABEL;
  }

  get targetLookupSelectionListLabel() {
    return TARGET_LOOKUP_SELECTION_LABEL;
  }

  get targetLookupFormElementClass() {
    const baseClass = "slds-form-element slds-lookup";
    return this.targetLookupErrorMessage
      ? `${baseClass} slds-has-error`
      : baseClass;
  }

  get targetLookupComboboxClass() {
    const classes = [
      "slds-combobox",
      "slds-dropdown-trigger",
      "slds-dropdown-trigger_click",
      "slds-combobox-lookup"
    ];
    if (this.targetLookupDropdownVisible) {
      classes.push("slds-is-open");
    }
    if (this.targetLookupFocused) {
      classes.push("slds-has-input-focus");
    }
    if (this.hasTargetObjectSelection) {
      classes.push("slds-has-selection");
    }
    return classes.join(" ");
  }

  get targetLookupDropdownAriaExpanded() {
    return this.targetLookupDropdownVisible ? "true" : "false";
  }

  get targetLookupAriaLabelledby() {
    return `${this.targetLookupLabelId} ${this.targetLookupListboxLabelId}`;
  }

  get targetLookupActiveOptionId() {
    if (
      this.targetLookupHighlightedIndex < 0 ||
      !Array.isArray(this.targetLookupOptions)
    ) {
      return null;
    }
    const option = this.targetLookupOptions[this.targetLookupHighlightedIndex];
    return option ? option.id : null;
  }

  get hasTargetObjectSelection() {
    return !!(
      this.targetObjectSelection &&
      typeof this.targetObjectSelection.apiName === "string" &&
      this.targetObjectSelection.apiName.length > 0
    );
  }

  get targetLookupDropdownVisible() {
    return (
      this.targetLookupDropdownOpen &&
      this.targetLookupFocused &&
      !this.hasTargetObjectSelection
    );
  }

  get targetLookupListHasOptions() {
    return (
      Array.isArray(this.targetLookupOptions) &&
      this.targetLookupOptions.length > 0
    );
  }

  get targetLookupShowInitialPrompt() {
    return (
      this.targetLookupDropdownVisible &&
      !this.targetLookupLoading &&
      !this.targetLookupSearchError &&
      !this.targetLookupListHasOptions &&
      !this.targetLookupSearchTerm
    );
  }

  get targetLookupShowNoResults() {
    return (
      this.targetLookupDropdownVisible &&
      !this.targetLookupLoading &&
      !this.targetLookupSearchError &&
      !this.targetLookupListHasOptions &&
      !!this.targetLookupSearchTerm
    );
  }

  get targetLookupAriaInvalid() {
    return this.targetLookupErrorMessage ? "true" : "false";
  }

  get defaultOperationField() {
    return DEFAULT_OPERATION_FIELD.fieldApiName;
  }

  get sourceTypeField() {
    return SOURCE_TYPE_FIELD.fieldApiName;
  }

  get sourceLocationField() {
    return SOURCE_LOCATION_FIELD.fieldApiName;
  }

  get externalSystemField() {
    return EXTERNAL_SYSTEM_FIELD.fieldApiName;
  }

  get notesField() {
    return NOTES_FIELD.fieldApiName;
  }

  get selectedBatchIdArray() {
    return this.selectedBatchId ? [this.selectedBatchId] : [];
  }

  get selectedStagingIdArray() {
    return this.selectedStagingId ? [this.selectedStagingId] : [];
  }

  get selectedBatch() {
    if (!this.selectedBatchId || !this.batches) {
      return undefined;
    }
    return this.batches.find((row) => row.Id === this.selectedBatchId);
  }

  get selectedStaging() {
    if (!this.selectedStagingId || !this.stagingRecords) {
      return undefined;
    }
    return this.stagingRecords.find((row) => row.Id === this.selectedStagingId);
  }

  get selectedStagingPayload() {
    const staging = this.selectedStaging;
    return staging && staging.Payload__c ? staging.Payload__c : "—";
  }

  get selectedStagingError() {
    const staging = this.selectedStaging;
    return staging && staging.Error_Message__c ? staging.Error_Message__c : "—";
  }

  get hasBatches() {
    return Array.isArray(this.batches) && this.batches.length > 0;
  }

  get hasStaging() {
    return Array.isArray(this.stagingRecords) && this.stagingRecords.length > 0;
  }

  get hasFieldValues() {
    return Array.isArray(this.fieldValues) && this.fieldValues.length > 0;
  }

  get batchesErrorMessage() {
    return this.batchesError ? this.reduceError(this.batchesError) : null;
  }

  get stagingErrorMessage() {
    return this.stagingError ? this.reduceError(this.stagingError) : null;
  }

  get fieldValueErrorMessage() {
    return this.fieldValueError ? this.reduceError(this.fieldValueError) : null;
  }

  @wire(fetchBatches, { limitSize: DEFAULT_BATCH_LIMIT })
  wiredBatches(result) {
    this.wiredBatchesResult = result;
    if (result.data) {
      this.batches = result.data;
      this.batchesError = undefined;
      if (this.selectedBatchId) {
        const stillExists = this.batches.some(
          (row) => row.Id === this.selectedBatchId
        );
        if (!stillExists) {
          this.selectedBatchId = undefined;
          this.stagingRecords = undefined;
          this.fieldValues = undefined;
        }
      }
    } else if (result.error) {
      this.batches = undefined;
      this.batchesError = result.error;
    }
  }

  handleBatchCreated() {
    this.resetTargetLookup();
    this.dispatchEvent(
      new ShowToastEvent({
        title: "Batch created",
        message: "New Reload Data Batch ready to receive staged records.",
        variant: "success"
      })
    );
    this.resetSelections();
    if (this.wiredBatchesResult) {
      refreshApex(this.wiredBatchesResult);
    }
  }

  handleCreateBatchClick() {
    this.formSubmitRequested = true;
    const form = this.template.querySelector('[data-id="batch-form"]');
    if (form) {
      form.submit();
    } else {
      this.formSubmitRequested = false;
    }
  }

  handleBatchSubmit(event) {
    if (!this.formSubmitRequested) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Handle target object lookup validation
    const fields = event.detail.fields;
    const targetFieldName = this.targetObjectField;
    fields[targetFieldName] = this.targetObjectApi;

    if (!fields[targetFieldName]) {
      this.targetLookupErrorMessage = TARGET_LOOKUP_REQUIRED_MESSAGE;
      this.focusTargetLookupInput();
      event.preventDefault();
      return;
    }

    this.targetLookupErrorMessage = undefined;
    this.formSubmitRequested = false;
  }
  resetSelections() {
    this.selectedBatchId = undefined;
    this.selectedStagingId = undefined;
    this.stagingRecords = undefined;
    this.fieldValues = undefined;
  }

  handleRefreshBatches() {
    this.resetSelections();
    if (this.wiredBatchesResult) {
      refreshApex(this.wiredBatchesResult);
    }
  }

  handleBatchSelection(event) {
    const selectedRows = event.detail.selectedRows;
    this.selectedBatchId =
      selectedRows && selectedRows.length ? selectedRows[0].Id : undefined;
    this.selectedStagingId = undefined;
    this.fieldValues = undefined;
    if (this.selectedBatchId) {
      this.loadStagingRecords(this.selectedBatchId);
    } else {
      this.stagingRecords = undefined;
    }
  }

  loadStagingRecords(batchId) {
    this.stagingLoading = true;
    fetchStagingRecords({ batchId })
      .then((data) => {
        this.stagingRecords = data;
        this.stagingError = undefined;
      })
      .catch((error) => {
        this.stagingError = error;
        this.stagingRecords = undefined;
      })
      .finally(() => {
        this.stagingLoading = false;
      });
  }

  handleStagingSelection(event) {
    const selectedRows = event.detail.selectedRows;
    this.selectedStagingId =
      selectedRows && selectedRows.length ? selectedRows[0].Id : undefined;
    if (this.selectedStagingId) {
      this.loadFieldValues(this.selectedStagingId);
    } else {
      this.fieldValues = undefined;
    }
  }

  loadFieldValues(stagingId) {
    this.fieldValuesLoading = true;
    fetchFieldValues({ stagingId })
      .then((data) => {
        this.fieldValues = data;
        this.fieldValueError = undefined;
      })
      .catch((error) => {
        this.fieldValueError = error;
        this.fieldValues = undefined;
      })
      .finally(() => {
        this.fieldValuesLoading = false;
      });
  }

  handleTargetLookupFocus() {
    this.targetLookupFocused = true;
    this.targetLookupDropdownOpen = true;
    this.targetLookupErrorMessage = undefined;
    if (
      Array.isArray(this.targetLookupOptions) &&
      this.targetLookupOptions.length > 0 &&
      this.targetLookupHighlightedIndex < 0
    ) {
      this.updateTargetLookupActiveOption(0);
    }
    if (
      !this.hasTargetObjectSelection &&
      (!this.targetLookupListHasOptions || this.targetLookupSearchError)
    ) {
      this.performTargetLookupSearch(this.targetLookupSearchTerm);
    }
  }

  handleTargetLookupInput(event) {
    this.targetLookupFocused = true;
    this.targetLookupDropdownOpen = true;
    this.targetLookupSearchTerm = event.target.value;
    this.targetLookupErrorMessage = undefined;
    this.updateTargetLookupActiveOption(-1);
    this.performTargetLookupSearch(this.targetLookupSearchTerm);
  }

  handleTargetLookupKeyDown(event) {
    if (this.hasTargetObjectSelection) {
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.targetLookupDropdownOpen = true;
        this.moveTargetLookupHighlight(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        this.targetLookupDropdownOpen = true;
        this.moveTargetLookupHighlight(-1);
        break;
      case "Enter":
        if (
          this.targetLookupDropdownVisible &&
          this.targetLookupHighlightedIndex >= 0
        ) {
          event.preventDefault();
          this.selectTargetLookupOptionByIndex(
            this.targetLookupHighlightedIndex
          );
        }
        break;
      case "Escape":
        if (this.targetLookupDropdownVisible) {
          event.preventDefault();
          this.targetLookupDropdownOpen = false;
          this.updateTargetLookupActiveOption(-1);
        }
        break;
      default:
        break;
    }
  }

  handleTargetLookupBlur() {
    this.targetLookupFocused = false;
    this.targetLookupDropdownOpen = false;
    this.updateTargetLookupActiveOption(-1);
  }

  handleTargetLookupOptionMouseDown(event) {
    event.preventDefault();
  }

  handleTargetLookupOptionMouseEnter(event) {
    const indexAttr = event.currentTarget.dataset.index;
    if (indexAttr === undefined) {
      return;
    }
    const index = parseInt(indexAttr, 10);
    if (Number.isNaN(index)) {
      return;
    }
    this.updateTargetLookupActiveOption(index);
  }

  handleTargetLookupSelect(event) {
    event.preventDefault();
    const indexAttr = event.currentTarget.dataset.index;
    if (indexAttr === undefined) {
      const value = event.currentTarget.dataset.value;
      if (!value) {
        return;
      }
      const option = this.targetLookupOptions.find(
        (item) => item.apiName === value
      );
      if (option) {
        this.selectTargetLookupOption(option);
      }
      return;
    }
    const index = parseInt(indexAttr, 10);
    if (Number.isNaN(index)) {
      return;
    }
    this.selectTargetLookupOptionByIndex(index);
  }

  handleTargetLookupRemove() {
    this.targetObjectSelection = undefined;
    this.targetObjectApi = undefined;
    this.targetLookupErrorMessage = undefined;
    this.targetLookupSearchError = undefined;
    this.targetLookupSearchTerm = "";
    this.clearTargetLookupOptions();
    this.targetLookupFocused = true;
    this.targetLookupDropdownOpen = true;
    this.latestTargetLookupRequest += 1;
    this.focusTargetLookupInput();
    this.performTargetLookupSearch(this.targetLookupSearchTerm);
  }

  selectTargetLookupOptionByIndex(index) {
    if (!Array.isArray(this.targetLookupOptions)) {
      return;
    }
    const option = this.targetLookupOptions[index];
    if (option) {
      this.selectTargetLookupOption(option);
    }
  }

  selectTargetLookupOption(option) {
    if (!option || typeof option.apiName !== "string") {
      return;
    }
    const selection = {
      apiName: option.apiName,
      label: option.label || option.apiName,
      iconName: option.iconName || "standard:default"
    };
    this.targetObjectSelection = selection;
    this.targetObjectApi = selection.apiName;
    this.targetLookupSearchTerm = "";
    this.clearTargetLookupOptions();
    this.targetLookupDropdownOpen = false;
    this.targetLookupErrorMessage = undefined;
    this.targetLookupSearchError = undefined;
    this.targetLookupLoading = false;
    this.targetLookupFocused = false;
    this.latestTargetLookupRequest += 1;
  }

  moveTargetLookupHighlight(step) {
    if (
      !Array.isArray(this.targetLookupOptions) ||
      this.targetLookupOptions.length === 0
    ) {
      return;
    }
    const optionsLength = this.targetLookupOptions.length;
    let nextIndex = this.targetLookupHighlightedIndex;
    if (nextIndex < 0) {
      nextIndex = step > 0 ? 0 : optionsLength - 1;
    } else {
      nextIndex = (nextIndex + step + optionsLength) % optionsLength;
    }
    this.updateTargetLookupActiveOption(nextIndex);
  }

  setTargetLookupOptions(results) {
    const rawOptions = Array.isArray(results) ? results : [];
    const sanitizedOptions = rawOptions.filter(
      (item) => item && typeof item.apiName === "string"
    );
    const activeIndex = sanitizedOptions.length > 0 ? 0 : -1;
    this.targetLookupOptions = sanitizedOptions.map((item, index) =>
      this.createTargetLookupOption(item, index, activeIndex)
    );
    this.targetLookupHighlightedIndex = activeIndex;
  }

  createTargetLookupOption(item, index, activeIndex) {
    const label =
      item && typeof item.label === "string" && item.label
        ? item.label
        : item.apiName;
    const iconName =
      item && typeof item.iconName === "string" && item.iconName
        ? item.iconName
        : "standard:default";
    const isActive = index === activeIndex;
    return {
      apiName: item.apiName,
      label,
      iconName,
      id: `${TARGET_LOOKUP_LISTBOX_ID}-option-${index}`,
      isActive,
      className: this.getTargetLookupOptionClasses(isActive),
      ariaSelected: isActive ? "true" : "false"
    };
  }

  getTargetLookupOptionClasses(isActive) {
    const classes = [
      "slds-media",
      "slds-listbox__option",
      "slds-listbox__option_entity",
      "slds-listbox__option_has-meta",
      "slds-media_small"
    ];
    if (isActive) {
      classes.push("slds-has-focus");
      classes.push("slds-is-active");
    }
    return classes.join(" ");
  }

  updateTargetLookupActiveOption(index) {
    if (
      !Array.isArray(this.targetLookupOptions) ||
      this.targetLookupOptions.length === 0
    ) {
      this.targetLookupHighlightedIndex = -1;
      return;
    }
    const lastIndex = this.targetLookupOptions.length - 1;
    let nextIndex = index;
    if (nextIndex < 0) {
      nextIndex = -1;
    } else if (nextIndex > lastIndex) {
      nextIndex = lastIndex;
    }
    this.targetLookupHighlightedIndex = nextIndex;
  }

  get targetLookupOptionsWithState() {
    if (!Array.isArray(this.targetLookupOptions)) {
      return [];
    }
    const highlighted = this.targetLookupHighlightedIndex;
    return this.targetLookupOptions.map((option, optionIndex) => {
      const isActive = optionIndex === highlighted;
      return Object.assign({}, option, {
        isActive,
        className: this.getTargetLookupOptionClasses(isActive),
        ariaSelected: isActive ? "true" : "false"
      });
    });
  }
  clearTargetLookupOptions() {
    this.targetLookupOptions = [];
    this.targetLookupHighlightedIndex = -1;
  }

  performTargetLookupSearch(rawSearchTerm) {
    if (this.hasTargetObjectSelection) {
      return;
    }
    const searchTerm = rawSearchTerm ? rawSearchTerm.trim() : "";
    const requestToken = ++this.latestTargetLookupRequest;
    this.targetLookupDropdownOpen = true;
    this.targetLookupLoading = true;
    this.targetLookupSearchError = undefined;
    searchTargetObjects({
      searchTerm,
      limitSize: TARGET_LOOKUP_SEARCH_LIMIT
    })
      .then((results) => {
        if (requestToken !== this.latestTargetLookupRequest) {
          return;
        }
        if (Array.isArray(results)) {
          this.setTargetLookupOptions(results);
        } else {
          this.clearTargetLookupOptions();
        }
      })
      .catch((error) => {
        if (requestToken !== this.latestTargetLookupRequest) {
          return;
        }
        this.clearTargetLookupOptions();
        this.targetLookupSearchError = this.reduceError(error);
      })
      .finally(() => {
        if (requestToken === this.latestTargetLookupRequest) {
          this.targetLookupLoading = false;
        }
      });
  }

  focusTargetLookupInput() {
    Promise.resolve().then(() => {
      const input = this.template.querySelector(
        '[data-id="target-lookup-input"]'
      );
      if (input) {
        input.focus();
      }
    });
  }

  resetTargetLookup() {
    this.targetObjectSelection = undefined;
    this.targetObjectApi = undefined;
    this.targetLookupSearchTerm = "";
    this.clearTargetLookupOptions();
    this.targetLookupErrorMessage = undefined;
    this.targetLookupSearchError = undefined;
    this.targetLookupLoading = false;
    this.targetLookupFocused = false;
    this.targetLookupDropdownOpen = false;
    this.latestTargetLookupRequest = 0;
  }
  handleUploadFinished(event) {
    const uploadedFiles = event.detail?.files ?? [];
    const fileNames = uploadedFiles.map((file) => file.name).join(", ");
    const defaultMessage =
      uploadedFiles.length > 1
        ? `S'han pujat ${uploadedFiles.length} fitxers.`
        : "S'ha pujat el fitxer correctament.";
    const message = fileNames
      ? `${defaultMessage} (${fileNames})`
      : defaultMessage;

    this.dispatchEvent(
      new ShowToastEvent({
        title: "Fitxer carregat",
        message,
        variant: "success"
      })
    );
  }

  handleTouchBatch() {
    if (!this.selectedBatchId) {
      return;
    }
    touchBatch({ batchId: this.selectedBatchId })
      .then(() => {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Batch updated",
            message: "The batch has been marked as recently run.",
            variant: "success"
          })
        );
        if (this.wiredBatchesResult) {
          refreshApex(this.wiredBatchesResult);
        }
      })
      .catch((error) => {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Unable to update batch",
            message: this.reduceError(error),
            variant: "error"
          })
        );
      });
  }

  reduceError(error) {
    if (!error) {
      return "Unknown error";
    }
    if (Array.isArray(error.body)) {
      return error.body.map((e) => e.message).join(", ");
    }
    if (error.body && typeof error.body.message === "string") {
      return error.body.message;
    }
    if (typeof error.message === "string") {
      return error.message;
    }
    return "Unknown error";
  }
}
