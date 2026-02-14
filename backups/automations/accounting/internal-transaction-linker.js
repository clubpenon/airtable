// This script is executed when changes are made to the list of
// linked transactions of a record and will link the newly linked
// transactions back to the current record. The script also takes
// care of unlinking when needed.

// Create a function so we can "return".
async function process_record() {

// This makes the "error" value always available in the next step.
output.set('error', '');

// Get the recordId of the record that is being created/processed.
let config = input.config();
let recordId = config.recordId;
console.log(`Processing transaction record with ID "${recordId}".`);

// Load the record (transaction).
let transactionsTable = base.getTable("Transactions");
let transactions = await transactionsTable.selectRecordsAsync({recordIds: [recordId], fields: transactionsTable.fields});
let transaction = transactions.getRecord(recordId);

// Iterate on linked transactions and link them back.
let linkedTransactions = transaction.getCellValue("Linked Transactions") || [];
for (let t of linkedTransactions) {
    // Fetch the linked transaction's linked transactions.
    let tlt = await transactionsTable.selectRecordsAsync({recordIds: [t.id], fields: transactionsTable.fields});
    let tt = tlt.getRecord(t.id);
    let ttlt = tt.getCellValue("Linked Transactions") || [];
    if (ttlt.some(linked => linked.id === recordId)) {
        continue;
    }
    let ttltn = [
        ...ttlt.map(v => ({ id: v.id })),
        { id: recordId }
    ];
    // Update the linked transaction's linked transactions.
    try {
        await transactionsTable.updateRecordAsync(t.id, {
            "Linked Transactions": ttltn,
        });
    } catch (error) {
        console.log(`Error: Failed to link transaction "${t.id} back to transaction "${recordId}": ${error.message}.`);
        output.set('error', `Failed to link transaction "${t.id} back to transaction "${recordId}": ${error.message}.`);
        return false;
    }
    console.log(`Successfully linked transaction "${t.id}" back to transaction "${recordId}".`);
}

// Find all transactions that link to the current transaction but are
// not found in its list of linked transactions and therefore should
// be unlinked.
let allTransactions = await transactionsTable.selectRecordsAsync({fields: [transactionsTable.getField("Linked Transactions")]});
// Create a set for faster lookup.
let linkedTransactionsSet = new Set(linkedTransactions.map(record => record.id));
for (let aRecord of allTransactions.records) {
    // Get the linked transactions for the current record.
    let linkedTransactions = aRecord.getCellValue("Linked Transactions") || [];
    // Check if the current record links back to our transaction.
    if (!linkedTransactions.some(linked => linked.id === recordId)) {
        continue;
    }
    // If this record should link back to A, skip.
    if (linkedTransactionsSet.has(aRecord.id)) {
        continue;
    }
    // Otherwise, we must remove the link.
    let updatedLinkedTransactions = linkedTransactions.filter(linked => linked.id !== recordId);
    try {
        await transactionsTable.updateRecordAsync(aRecord.id, {
                "Linked Transactions": updatedLinkedTransactions
        });
    } catch (error) {
        console.log(`Error: Failed to unlink transaction "${recordId} from transaction "${aRecord.id}": ${error.message}.`);
        output.set('error', `Failed to unlink transaction "${recordId} from transaction "${aRecord.id}": ${error.message}.`);
        return false;
    }
    console.log(`Successfully unlinked transaction "${recordId}" from transaction "${aRecord.id}".`);
};

return true;
}

let result = await process_record();
output.set('return', result);
