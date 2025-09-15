public with sharing class ReloadWorkspaceController {
  private static final Integer MAX_RESULTS = 200;
  private static final Integer MAX_LOOKUP_RESULTS = 50;

  public class TargetObjectOption implements Comparable {
    @AuraEnabled
    public String apiName;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String iconName;

    public TargetObjectOption(String apiNameValue, String labelValue, String iconNameValue) {
      apiName = apiNameValue;
      label = labelValue;
      iconName = iconNameValue;
    }

    public Integer compareTo(Object other) {
      TargetObjectOption otherOption = (TargetObjectOption) other;
      String thisLabel = label != null ? label.toLowerCase() : '';
      String otherLabel =
        otherOption != null && otherOption.label != null
          ? otherOption.label.toLowerCase()
          : '';
      return thisLabel.compareTo(otherLabel);
    }
  }

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

  @AuraEnabled(cacheable=true)
  public static List<TargetObjectOption> searchTargetObjects(
    String searchTerm,
    Integer limitSize
  ) {
    Integer queryLimit =
      limitSize == null || limitSize <= 0
        ? 10
        : Integer.valueOf(Math.min(limitSize, MAX_LOOKUP_RESULTS));
    String normalizedSearch = searchTerm == null ? '' : searchTerm.trim().toLowerCase();

    Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
    List<TargetObjectOption> matches = new List<TargetObjectOption>();

    for (Schema.SObjectType typeToken : globalDescribe.values()) {
      Schema.DescribeSObjectResult describeResult = typeToken.getDescribe();
      if (
        !describeResult.isAccessible() ||
        !describeResult.isQueryable() ||
        describeResult.isDeprecatedAndHidden() ||
        describeResult.isCustomSetting()
      ) {
        continue;
      }

      String apiName = describeResult.getName();
      String label = describeResult.getLabel();
      String lowerLabel = label != null ? label.toLowerCase() : '';
      String lowerApi = apiName != null ? apiName.toLowerCase() : '';

      if (
        normalizedSearch == '' ||
        lowerLabel.contains(normalizedSearch) ||
        lowerApi.contains(normalizedSearch)
      ) {
        String iconName = describeResult.isCustom() ? 'custom:custom63' : 'standard:default';
        matches.add(new TargetObjectOption(apiName, label, iconName));
      }
    }

    matches.sort();

    if (matches.size() > queryLimit) {
      return matches.subList(0, queryLimit);
    }

    return matches;
  }
}
