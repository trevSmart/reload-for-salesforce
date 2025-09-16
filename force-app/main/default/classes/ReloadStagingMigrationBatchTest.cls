@IsTest
private class ReloadStagingMigrationBatchTest {
  @IsTest
  static void testRunMigrationNowInsertsRecord() {
    Reload_Batch__c batch = new Reload_Batch__c(
      Target_Object_API__c = 'Account',
      Default_Operation__c = 'Insert',
      Status__c = 'Ready',
      Source_Type__c = 'CSV',
      Source_Location__c = 'insert.csv',
      External_System__c = 'Test Harness'
    );
    insert batch;

    Reload_Staging__c staging = new Reload_Staging__c(
      Batch__c = batch.Id,
      Status__c = 'Ready',
      Record_Action__c = 'Insert',
      Target_Object_API__c = 'Account'
    );
    insert staging;

    insert new Reload_Field_Value__c(
      Staging_Record__c = staging.Id,
      Field_API_Name__c = 'Name',
      Field_Label__c = 'Name',
      Field_Type__c = 'Text',
      Field_Value__c = 'Reload Account Immediate',
      Sequence__c = 1,
      Is_Key__c = false
    );

    Test.startTest();
    String jobId = ReloadWorkspaceController.runMigrationNow(batch.Id, 50);
    Test.stopTest();

    System.assertNotEquals(
      null,
      jobId,
      'Job Id should be returned for immediate execution'
    );

    Account[] insertedAccounts = [
      SELECT Name
      FROM Account
      WHERE Name = 'Reload Account Immediate'
    ];
    System.assertEquals(
      1,
      insertedAccounts.size(),
      'The Account record should be inserted'
    );

    Reload_Staging__c updatedStaging = [
      SELECT Status__c, Error_Message__c
      FROM Reload_Staging__c
      WHERE Id = :staging.Id
      LIMIT 1
    ];
    System.assertEquals(
      'Success',
      updatedStaging.Status__c,
      'Staging record should be marked as success'
    );
    System.assertEquals(
      null,
      updatedStaging.Error_Message__c,
      'Staging record should not store errors'
    );

    Reload_Batch__c updatedBatch = [
      SELECT Status__c, Processed_Records__c, Error_Count__c, Total_Records__c
      FROM Reload_Batch__c
      WHERE Id = :batch.Id
      LIMIT 1
    ];
    System.assertEquals(
      'Completed',
      updatedBatch.Status__c,
      'Batch should be marked as completed'
    );
    System.assertEquals(
      1,
      updatedBatch.Processed_Records__c,
      'Processed counter should record successes'
    );
    System.assertEquals(
      0,
      updatedBatch.Error_Count__c,
      'Error counter should be zero'
    );
    System.assertEquals(
      1,
      updatedBatch.Total_Records__c,
      'Total records should match the processed staging rows'
    );
  }

  @IsTest
  static void testScheduleMigrationUpdatesRecord() {
    Account existingAccount = new Account(Name = 'Account Original');
    insert existingAccount;

    Reload_Batch__c batch = new Reload_Batch__c(
      Target_Object_API__c = 'Account',
      Default_Operation__c = 'Update',
      Status__c = 'Ready',
      Source_Type__c = 'CSV',
      Source_Location__c = 'update.csv',
      External_System__c = 'Test Harness'
    );
    insert batch;

    Reload_Staging__c staging = new Reload_Staging__c(
      Batch__c = batch.Id,
      Status__c = 'Ready',
      Record_Action__c = 'Update',
      Target_Object_API__c = 'Account'
    );
    insert staging;

    insert new Reload_Field_Value__c(
      Staging_Record__c = staging.Id,
      Field_API_Name__c = 'Id',
      Field_Label__c = 'Id',
      Field_Type__c = 'Id',
      Field_Value__c = String.valueOf(existingAccount.Id),
      Sequence__c = 1,
      Is_Key__c = true
    );

    insert new Reload_Field_Value__c(
      Staging_Record__c = staging.Id,
      Field_API_Name__c = 'Name',
      Field_Label__c = 'Name',
      Field_Type__c = 'Text',
      Field_Value__c = 'Account Programat',
      Sequence__c = 2,
      Is_Key__c = false
    );

    Test.startTest();
    String jobId = ReloadWorkspaceController.scheduleMigration(
      batch.Id,
      System.now().addSeconds(5),
      25
    );
    Test.stopTest();

    System.assertNotEquals(
      null,
      jobId,
      'Job Id should be returned for scheduled execution'
    );

    Account refreshedAccount = [
      SELECT Name
      FROM Account
      WHERE Id = :existingAccount.Id
      LIMIT 1
    ];
    System.assertEquals(
      'Account Programat',
      refreshedAccount.Name,
      'Scheduled job should update the Account name'
    );

    Reload_Staging__c updatedStaging = [
      SELECT Status__c, Error_Message__c
      FROM Reload_Staging__c
      WHERE Id = :staging.Id
      LIMIT 1
    ];
    System.assertEquals(
      'Success',
      updatedStaging.Status__c,
      'Staging record should be marked as success after scheduled run'
    );
    System.assertEquals(
      null,
      updatedStaging.Error_Message__c,
      'No error should be stored for a successful run'
    );

    Reload_Batch__c updatedBatch = [
      SELECT Status__c, Processed_Records__c, Error_Count__c
      FROM Reload_Batch__c
      WHERE Id = :batch.Id
      LIMIT 1
    ];
    System.assertEquals(
      'Completed',
      updatedBatch.Status__c,
      'Batch should be completed after the scheduled run'
    );
    System.assertEquals(
      1,
      updatedBatch.Processed_Records__c,
      'Processed counter should be incremented'
    );
    System.assertEquals(
      0,
      updatedBatch.Error_Count__c,
      'Scheduled execution should not register errors'
    );
  }
}
