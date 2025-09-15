public with sharing class ReloadWorkspaceController {
  private static final Integer MAX_RESULTS = 200;

  @AuraEnabled(cacheable=true)
  public static List<Reload_Batch__c> fetchBatches(Integer limitSize) {
    Integer queryLimit = limitSize == null ||
      limitSize <= 0
      ? 50
      : Integer.valueOf(Math.min(limitSize, MAX_RESULTS));
    return [
      SELECT
        Id,
        Name,
        Target_Object_API__c,
        Default_Operation__c,
        Status__c,
        Source_Type__c,
        Source_Location__c,
        External_System__c,
        Total_Records__c,
        Processed_Records__c,
        Error_Count__c,
        Last_Run__c,
        CreatedDate
      FROM Reload_Batch__c
      ORDER BY CreatedDate DESC
      LIMIT :queryLimit
    ];
  }

  @AuraEnabled(cacheable=true)
  public static List<Reload_Staging__c> fetchStagingRecords(Id batchId) {
    if (batchId == null) {
      return new List<Reload_Staging__c>();
    }

    return [
      SELECT
        Id,
        Name,
        Batch__c,
        Status__c,
        Record_Action__c,
        Target_Object_API__c,
        External_Id_Field__c,
        Source_Row_Number__c,
        Source_Reference__c,
        Origin_Type__c,
        Created_From__c,
        Field_Count__c,
        Record_Hash__c,
        Error_Message__c,
        Payload__c
      FROM Reload_Staging__c
      WHERE Batch__c = :batchId
      ORDER BY Source_Row_Number__c ASC
      LIMIT :MAX_RESULTS
    ];
  }

  @AuraEnabled(cacheable=true)
  public static List<Reload_Field_Value__c> fetchFieldValues(Id stagingId) {
    if (stagingId == null) {
      return new List<Reload_Field_Value__c>();
    }

    return [
      SELECT
        Id,
        Name,
        Staging_Record__c,
        Field_Label__c,
        Field_API_Name__c,
        Field_Type__c,
        Field_Value__c,
        Sequence__c,
        Is_Key__c
      FROM Reload_Field_Value__c
      WHERE Staging_Record__c = :stagingId
      ORDER BY Sequence__c ASC, Field_Label__c ASC
      LIMIT :MAX_RESULTS
    ];
  }

  @AuraEnabled
  public static Reload_Batch__c touchBatch(Id batchId) {
    if (batchId == null) {
      throw new AuraHandledException('Batch Id is required.');
    }

    Reload_Batch__c batch = [
      SELECT Id, Last_Run__c
      FROM Reload_Batch__c
      WHERE Id = :batchId
      LIMIT 1
    ];
    batch.Last_Run__c = System.now();
    update batch;
    return batch;
  }
}
