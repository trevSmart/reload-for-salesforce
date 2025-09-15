@IsTest
private class ReloadWorkspaceControllerTest {
  @IsTest
  static void testControllerOperations() {
    Reload_Batch__c batch = new Reload_Batch__c(
      Target_Object_API__c = 'Account',
      Default_Operation__c = 'Insert',
      Status__c = 'Draft',
      Source_Type__c = 'CSV',
      Source_Location__c = 'test.csv',
      Total_Records__c = 1,
      Processed_Records__c = 0,
      Error_Count__c = 0
    );
    insert batch;

    Reload_Staging__c staging = new Reload_Staging__c(
      Batch__c = batch.Id,
      Status__c = 'Pending',
      Record_Action__c = 'Insert',
      Source_Row_Number__c = 1,
      Field_Count__c = 2,
      Origin_Type__c = 'File Upload',
      Target_Object_API__c = 'Account'
    );
    insert staging;

    Reload_Field_Value__c fieldValue = new Reload_Field_Value__c(
      Staging_Record__c = staging.Id,
      Field_API_Name__c = 'Name',
      Field_Label__c = 'Name',
      Field_Type__c = 'Text',
      Field_Value__c = 'ACME',
      Sequence__c = 1,
      Is_Key__c = true
    );
    insert fieldValue;

    Test.startTest();
    List<Reload_Batch__c> batches = ReloadWorkspaceController.fetchBatches(10);
    List<Reload_Staging__c> staged = ReloadWorkspaceController.fetchStagingRecords(
      batch.Id
    );
    List<Reload_Field_Value__c> values = ReloadWorkspaceController.fetchFieldValues(
      staging.Id
    );
    Reload_Batch__c touched = ReloadWorkspaceController.touchBatch(batch.Id);
    Test.stopTest();

    System.assertEquals(1, batches.size(), 'Should return the inserted batch');
    System.assertEquals(
      1,
      staged.size(),
      'Should return the inserted staging record'
    );
    System.assertEquals(
      1,
      values.size(),
      'Should return the inserted field value'
    );
    System.assertNotEquals(
      null,
      touched.Last_Run__c,
      'Touch should stamp last run'
    );

    System.assertEquals(
      0,
      ReloadWorkspaceController.fetchStagingRecords(null).size(),
      'Null batch id should return empty list'
    );
    System.assertEquals(
      0,
      ReloadWorkspaceController.fetchFieldValues(null).size(),
      'Null staging id should return empty list'
    );

    Boolean didThrow = false;
    try {
      ReloadWorkspaceController.touchBatch(null);
    } catch (AuraHandledException e) {
      didThrow = true;
    }
    System.assert(
      didThrow,
      'Touching without an Id should throw an AuraHandledException'
    );
  }

  @IsTest
  static void testSearchTargetObjects() {
    Test.startTest();
    List<ReloadWorkspaceController.TargetObjectOption> accountResults = ReloadWorkspaceController.searchTargetObjects(
      'Acc',
      10
    );
    List<ReloadWorkspaceController.TargetObjectOption> limitedResults = ReloadWorkspaceController.searchTargetObjects(
      null,
      1
    );
    Test.stopTest();

    System.assert(
      accountResults.size() > 0,
      'Search should return available objects'
    );

    Boolean foundAccount = false;
    for (ReloadWorkspaceController.TargetObjectOption option : accountResults) {
      if (option.apiName == 'Account') {
        foundAccount = true;
        System.assertNotEquals(null, option.label, 'Label should be provided');
        System.assertNotEquals(
          null,
          option.iconName,
          'Icon should be provided'
        );
      }
    }
    System.assert(foundAccount, 'Account should appear in the search results');

    System.assertEquals(
      1,
      limitedResults.size(),
      'Limit parameter should restrict the number of results'
    );
  }
}
