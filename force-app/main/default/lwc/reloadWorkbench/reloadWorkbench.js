import { LightningElement, track, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { refreshApex } from "@salesforce/apex";

import fetchBatches from "@salesforce/apex/ReloadWorkspaceController.fetchBatches";
import fetchStagingRecords from "@salesforce/apex/ReloadWorkspaceController.fetchStagingRecords";
import fetchFieldValues from "@salesforce/apex/ReloadWorkspaceController.fetchFieldValues";
import touchBatch from "@salesforce/apex/ReloadWorkspaceController.touchBatch";

import TARGET_OBJECT_FIELD from "@salesforce/schema/Reload_Batch__c.Target_Object_API__c";
import DEFAULT_OPERATION_FIELD from "@salesforce/schema/Reload_Batch__c.Default_Operation__c";
import SOURCE_TYPE_FIELD from "@salesforce/schema/Reload_Batch__c.Source_Type__c";
import SOURCE_LOCATION_FIELD from "@salesforce/schema/Reload_Batch__c.Source_Location__c";
import EXTERNAL_SYSTEM_FIELD from "@salesforce/schema/Reload_Batch__c.External_System__c";
import NOTES_FIELD from "@salesforce/schema/Reload_Batch__c.Notes__c";

const DEFAULT_BATCH_LIMIT = 50;

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

  selectedBatchId;
  selectedStagingId;

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
