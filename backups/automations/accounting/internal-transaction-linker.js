// This script is executed when changes are made to the list of
// linked transactions of a record and will link the newly linked
// transactions back to the current record. The script also takes
// care of unlinking when needed.

// Create a function so we can "return".
async function process_record() {

// Get the recordId of the record that is being processed.
let config = input.config();
let recordId = config.recordId;
console.log(`Processing transaction record with ID "${recordId}".`);

// Load the record (transaction).
let transactionsTable = base.getTable("Transactions");
let transactions = await transactionsTable.selectRecordsAsync({recordIds: [recordId], fields: transactionsTable.fields});
let transaction = transactions.getRecord(recordId);

// In this script, "links" is shorthand for "Linked Transactions" cell values.

// --- PART 1: Link back ---
// For each transaction in our links, make sure it links back to us.
let links = transaction.getCellValue("Linked Transactions") || [];
for (let linkRef of links) {
    // Fetch the linked transaction record and its own links.
    let linkedQuery = await transactionsTable.selectRecordsAsync({recordIds: [linkRef.id], fields: transactionsTable.fields});
    let linkedRecord = linkedQuery.getRecord(linkRef.id);
    let linkedRecordLinks = linkedRecord.getCellValue("Linked Transactions") || [];
    // If it already links back to us, nothing to do.
    if (linkedRecordLinks.some(ref => ref.id === recordId)) {
        console.log(`Transaction "${linkRef.id}" already links back to "${recordId}", skipping.`);
        continue;
    }
    // Add us to its links.
    let updatedLinks = [
        ...linkedRecordLinks.map(ref => ({ id: ref.id })),
        { id: recordId }
    ];
    try {
        await transactionsTable.updateRecordAsync(linkRef.id, {
            "Linked Transactions": updatedLinks,
        });
    } catch (error) {
        throw new Error(`Failed to link transaction "${linkRef.id}" back to transaction "${recordId}": ${error.message}`);
    }
    console.log(`Successfully linked transaction "${linkRef.id}" back to transaction "${recordId}".`);
}

// --- PART 2: Unlink stale reverse links ---
// When a link is removed from our record, the other transaction may still
// link back to us. We scan all transactions to find and clean up these
// stale reverse links.
let allTransactions = await transactionsTable.selectRecordsAsync({fields: [transactionsTable.getField("Linked Transactions")]});
let linksSet = new Set(links.map(ref => ref.id));
for (let record of allTransactions.records) {
    // Skip self.
    if (record.id === recordId) {
        continue;
    }
    let recordLinks = record.getCellValue("Linked Transactions") || [];
    // Skip if this record doesn't link to us.
    if (!recordLinks.some(ref => ref.id === recordId)) {
        continue;
    }
    // Skip if we still link to this record (the link is valid, not stale).
    if (linksSet.has(record.id)) {
        continue;
    }
    // This record links to us but we no longer link to it. Remove the stale reverse link.
    let cleanedLinks = recordLinks.filter(ref => ref.id !== recordId);
    try {
        await transactionsTable.updateRecordAsync(record.id, {
                "Linked Transactions": cleanedLinks
        });
    } catch (error) {
        throw new Error(`Failed to unlink transaction "${recordId}" from transaction "${record.id}": ${error.message}`);
    }
    console.log(`Successfully unlinked transaction "${recordId}" from transaction "${record.id}".`);
}

console.log(`Done processing transaction record with ID "${recordId}".`);
}

process_record();
