public with sharing class ReloadStagingMigrationBatch implements Database.Batchable<Reload_Staging__c>, Database.Stateful, Schedulable {
  public static final Integer DEFAULT_SCOPE_SIZE = 200;

  private final Id batchId;
  private final Integer scopeSize;
  private Reload_Batch__c batchRecord;
  private Integer processedCount = 0;
  private Integer successCount = 0;
  private Integer errorCount = 0;

  public ReloadStagingMigrationBatch(Id batchIdValue, Integer scopeSizeValue) {
    batchId = batchIdValue;
    scopeSize = scopeSizeValue;
  }

  public void execute(SchedulableContext context) {
    Integer size = scopeSize != null && scopeSize > 0
      ? scopeSize
      : DEFAULT_SCOPE_SIZE;
    Database.executeBatch(this, size);
  }

  public Database.QueryLocator start(Database.BatchableContext context) {
    if (batchId == null) {
      throw new MigrationException('Batch Id is required to run the migration.');
    }

    batchRecord = [
      SELECT Id, Target_Object_API__c, Default_Operation__c
      FROM Reload_Batch__c
      WHERE Id = :batchId
      LIMIT 1
    ];

    update new Reload_Batch__c(Id = batchId, Status__c = 'Processing');

    return Database.getQueryLocator([
      SELECT
        Id,
        Record_Action__c,
        Target_Object_API__c,
        External_Id_Field__c,
        Status__c
      FROM Reload_Staging__c
      WHERE Batch__c = :batchId AND
        Status__c NOT IN ('Success', 'Skipped', 'Processing')
      ORDER BY Source_Row_Number__c ASC, CreatedDate ASC
    ]);
  }

  public void execute(Database.BatchableContext context, List<Reload_Staging__c> scope) {
    if (scope.isEmpty()) {
      return;
    }

    Set<Id> stagingIds = new Set<Id>();
    for (Reload_Staging__c staging : scope) {
      stagingIds.add(staging.Id);
    }

    Map<Id, List<Reload_Field_Value__c>> fieldValuesByStaging = new Map<Id, List<Reload_Field_Value__c>>();
    for (Reload_Field_Value__c fieldValue : [
      SELECT
        Id,
        Staging_Record__c,
        Field_API_Name__c,
        Field_Type__c,
        Field_Value__c,
        Is_Key__c,
        Sequence__c
      FROM Reload_Field_Value__c
      WHERE Staging_Record__c IN :stagingIds
      ORDER BY Sequence__c ASC
    ]) {
      if (!fieldValuesByStaging.containsKey(fieldValue.Staging_Record__c)) {
        fieldValuesByStaging.put(
          fieldValue.Staging_Record__c,
          new List<Reload_Field_Value__c>()
        );
      }
      fieldValuesByStaging.get(fieldValue.Staging_Record__c).add(fieldValue);
    }

    List<Reload_Staging__c> stagingUpdates = new List<Reload_Staging__c>();

    for (Reload_Staging__c stagingRecord : scope) {
      processedCount++;
      Reload_Staging__c stagingUpdate = new Reload_Staging__c(Id = stagingRecord.Id);

      try {
        processSingleStagingRecord(
          stagingRecord,
          fieldValuesByStaging.get(stagingRecord.Id)
        );
        stagingUpdate.Status__c = 'Success';
        stagingUpdate.Error_Message__c = null;
        successCount++;
      } catch (Exception error) {
        stagingUpdate.Status__c = 'Error';
        stagingUpdate.Error_Message__c = limitErrorMessage(error.getMessage());
        errorCount++;
      }

      stagingUpdates.add(stagingUpdate);
    }

    if (!stagingUpdates.isEmpty()) {
      update stagingUpdates;
    }
  }

  public void finish(Database.BatchableContext context) {
    Reload_Batch__c batchUpdate = new Reload_Batch__c(Id = batchId);
    batchUpdate.Processed_Records__c = successCount;
    batchUpdate.Error_Count__c = errorCount;
    batchUpdate.Total_Records__c = processedCount;
    batchUpdate.Last_Run__c = System.now();
    batchUpdate.Status__c = errorCount > 0 ? 'Failed' : 'Completed';
    update batchUpdate;
  }

  private void processSingleStagingRecord(
    Reload_Staging__c stagingRecord,
    List<Reload_Field_Value__c> fieldValues
  ) {
    if (batchRecord == null) {
      throw new MigrationException('Batch context not initialized.');
    }

    String targetApiName = !String.isBlank(stagingRecord.Target_Object_API__c)
      ? stagingRecord.Target_Object_API__c
      : batchRecord.Target_Object_API__c;

    if (String.isBlank(targetApiName)) {
      throw new MigrationException(
        'No s\'ha definit cap objecte de destinació per al registre en staging.'
      );
    }

    Schema.SObjectType targetType = Schema.getGlobalDescribe().get(targetApiName);
    if (targetType == null) {
      throw new MigrationException(
        'L\'objecte de destinació ' + targetApiName + ' no existeix a l\'org.'
      );
    }

    Operation operation = resolveOperation(stagingRecord);

    Schema.DescribeSObjectResult describe = targetType.getDescribe();
    validateCrudAccess(describe, operation);

    Map<String, Schema.SObjectField> fieldDescribeMap = describe.fields.getMap();
    Map<String, Reload_Field_Value__c> valueMap = new Map<String, Reload_Field_Value__c>();

    if (fieldValues != null) {
      for (Reload_Field_Value__c value : fieldValues) {
        if (String.isBlank(value.Field_API_Name__c)) {
          continue;
        }
        valueMap.put(value.Field_API_Name__c, value);
      }
    }

    SObject targetRecord = targetType.newSObject();

    for (String fieldName : valueMap.keySet()) {
      Schema.SObjectField fieldToken = fieldDescribeMap.get(fieldName);
      if (fieldToken == null) {
        continue;
      }
      Schema.DescribeFieldResult fieldDescribe = fieldToken.getDescribe();
      Object convertedValue = convertFieldValue(
        valueMap.get(fieldName).Field_Value__c,
        fieldDescribe
      );
      targetRecord.put(fieldName, convertedValue);
    }

    Id targetId = null;
    if (valueMap.containsKey('Id')) {
      String rawId = valueMap.get('Id').Field_Value__c;
      if (!String.isBlank(rawId)) {
        targetId = (Id) rawId;
        targetRecord.put('Id', targetId);
      }
    }

    switch on operation {
      when Operation.Insert {
        performInsert(targetRecord);
      }
      when Operation.Update {
        if (targetId == null) {
          throw new MigrationException(
            'Cal proporcionar un Id per poder actualitzar el registre.'
          );
        }
        performUpdate(targetRecord);
      }
      when Operation.Upsert {
        performUpsert(targetRecord, stagingRecord, fieldDescribeMap);
      }
      when Operation.Delete {
        if (targetId == null) {
          throw new MigrationException(
            'Cal proporcionar un Id per poder eliminar el registre.'
          );
        }
        performDelete(targetRecord);
      }
    }
  }

  private void performInsert(SObject recordToInsert) {
    Database.SaveResult result = Database.insert(recordToInsert, false);
    if (!result.isSuccess()) {
      throw new MigrationException(buildErrorMessage(result.getErrors()));
    }
  }

  private void performUpdate(SObject recordToUpdate) {
    Database.SaveResult result = Database.update(recordToUpdate, false);
    if (!result.isSuccess()) {
      throw new MigrationException(buildErrorMessage(result.getErrors()));
    }
  }

  private void performDelete(SObject recordToDelete) {
    Database.DeleteResult result = Database.delete(recordToDelete, false);
    if (!result.isSuccess()) {
      throw new MigrationException(buildErrorMessage(result.getErrors()));
    }
  }

  private void performUpsert(
    SObject recordToUpsert,
    Reload_Staging__c stagingRecord,
    Map<String, Schema.SObjectField> fieldDescribeMap
  ) {
    List<SObject> payload = new List<SObject>{ recordToUpsert };
    if (!String.isBlank(stagingRecord.External_Id_Field__c)) {
      Schema.SObjectField externalField = fieldDescribeMap.get(
        stagingRecord.External_Id_Field__c
      );
      if (externalField == null) {
        throw new MigrationException(
          'El camp d\'identificador extern ' +
          stagingRecord.External_Id_Field__c +
          ' no existeix a l\'objecte.'
        );
      }
      Database.UpsertResult[] results = Database.upsert(
        payload,
        externalField,
        false
      );
      if (!results.isEmpty() && !results[0].isSuccess()) {
        throw new MigrationException(buildErrorMessage(results[0].getErrors()));
      }
    } else {
      Database.UpsertResult[] results = Database.upsert(payload, false);
      if (!results.isEmpty() && !results[0].isSuccess()) {
        throw new MigrationException(buildErrorMessage(results[0].getErrors()));
      }
    }
  }

  private Operation resolveOperation(Reload_Staging__c stagingRecord) {
    String requestedOperation = !String.isBlank(stagingRecord.Record_Action__c)
      ? stagingRecord.Record_Action__c
      : batchRecord.Default_Operation__c;

    if (String.isBlank(requestedOperation)) {
      throw new MigrationException(
        'No s\'ha especificat cap operació per al registre en staging.'
      );
    }

    String normalized = requestedOperation.trim().toLowerCase();
    if (normalized == 'insert') {
      return Operation.Insert;
    }
    if (normalized == 'update') {
      return Operation.Update;
    }
    if (normalized == 'upsert') {
      return Operation.Upsert;
    }
    if (normalized == 'delete') {
      return Operation.Delete;
    }

    throw new MigrationException(
      'L\'operació especificada (' + requestedOperation + ') no és compatible.'
    );
  }

  private void validateCrudAccess(
    Schema.DescribeSObjectResult describe,
    Operation operation
  ) {
    switch on operation {
      when Operation.Insert {
        if (!describe.isCreateable()) {
          throw new MigrationException(
            'No tens permisos per crear registres a l\'objecte de destinació.'
          );
        }
      }
      when Operation.Update {
        if (!describe.isUpdateable()) {
          throw new MigrationException(
            'No tens permisos per actualitzar registres a l\'objecte de destinació.'
          );
        }
      }
      when Operation.Delete {
        if (!describe.isDeletable()) {
          throw new MigrationException(
            'No tens permisos per eliminar registres a l\'objecte de destinació.'
          );
        }
      }
      when Operation.Upsert {
        if (!describe.isCreateable() && !describe.isUpdateable()) {
          throw new MigrationException(
            'Cal permís de creació o actualització per executar un upsert.'
          );
        }
      }
    }
  }

  private Object convertFieldValue(
    String rawValue,
    Schema.DescribeFieldResult fieldDescribe
  ) {
    if (rawValue == null) {
      return null;
    }
    String trimmedValue = rawValue.trim();
    Schema.DisplayType displayType = fieldDescribe.getType();

    if (
      trimmedValue == '' &&
      displayType != Schema.DisplayType.String &&
      displayType != Schema.DisplayType.TextArea &&
      displayType != Schema.DisplayType.Phone &&
      displayType != Schema.DisplayType.Email &&
      displayType != Schema.DisplayType.URL &&
      displayType != Schema.DisplayType.EncryptedText
    ) {
      return null;
    }

    try {
      switch on displayType {
        when Schema.DisplayType.Boolean {
          return trimmedValue.equalsIgnoreCase('true') || trimmedValue == '1';
        }
        when Schema.DisplayType.Date {
          return Date.valueOf(trimmedValue);
        }
        when Schema.DisplayType.Datetime {
          return Datetime.valueOf(trimmedValue);
        }
        when Schema.DisplayType.Double {
          return Decimal.valueOf(trimmedValue);
        }
        when Schema.DisplayType.Currency {
          return Decimal.valueOf(trimmedValue);
        }
        when Schema.DisplayType.Percent {
          return Decimal.valueOf(trimmedValue);
        }
        when Schema.DisplayType.Integer {
          return Integer.valueOf(trimmedValue);
        }
        when Schema.DisplayType.Long {
          return Long.valueOf(trimmedValue);
        }
        when Schema.DisplayType.Time {
          return Time.valueOf(trimmedValue);
        }
        when Schema.DisplayType.Id {
          return (Id) trimmedValue;
        }
        when Schema.DisplayType.Location {
          return JSON.deserializeUntyped(trimmedValue);
        }
        when Schema.DisplayType.Base64 {
          return EncodingUtil.base64Decode(trimmedValue);
        }
        when Schema.DisplayType.String {
          return rawValue;
        }
        when Schema.DisplayType.TextArea {
          return rawValue;
        }
        when Schema.DisplayType.Email {
          return rawValue;
        }
        when Schema.DisplayType.Phone {
          return rawValue;
        }
        when Schema.DisplayType.URL {
          return rawValue;
        }
        when Schema.DisplayType.EncryptedText {
          return rawValue;
        }
        when else {
          return rawValue;
        }
      }
    } catch (Exception conversionError) {
      throw new MigrationException(
        'No s\'ha pogut convertir el valor per al camp ' +
        fieldDescribe.getName() +
        ': ' +
        conversionError.getMessage()
      );
    }
  }

  private String buildErrorMessage(Database.Error[] errors) {
    if (errors == null || errors.isEmpty()) {
      return 'S\'ha produït un error desconegut durant el DML.';
    }
    List<String> messages = new List<String>();
    for (Database.Error error : errors) {
      if (error == null) {
        continue;
      }
      messages.add(error.getMessage());
    }
    return String.join(messages, ' | ');
  }

  private String limitErrorMessage(String message) {
    if (String.isBlank(message)) {
      return 'S\'ha produït un error desconegut durant la migració.';
    }
    Integer maxLength = 32768;
    return message.length() > maxLength
      ? message.substring(0, maxLength)
      : message;
  }

  private enum Operation {
    Insert,
    Update,
    Upsert,
    Delete
  }

  public class MigrationException extends Exception {}
}
