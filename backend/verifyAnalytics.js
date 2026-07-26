const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    console.log('Testing /api/analytics/overview...');
    const overview = await get('http://localhost:3001/api/analytics/overview?batch=2023-2027');
    console.log('Overview Results:');
    console.log('  totalStudents:', overview.totalStudents);
    console.log('  studentsWithAtLeastOneInternship:', overview.studentsWithAtLeastOneInternship);
    console.log('  studentsWithNoInternship:', overview.studentsWithNoInternship);
    console.log('  totalUniqueCompanies:', overview.totalUniqueCompanies);
    console.log('  totalCreditsCalculated:', overview.totalCreditsCalculated);
    console.log('  averageCreditsPerStudent:', overview.averageCreditsPerStudent);
    console.log('  totalInternshipEntries:', overview.totalInternshipEntries);
    console.log('  entriesNeedingReview:', overview.entriesNeedingReview);
    console.log('  entriesNeedingReviewBreakdown:', overview.entriesNeedingReviewBreakdown);
    console.log('  divisionBreakdown:', overview.divisionBreakdown);

    console.log('\nTesting /api/analytics/companies...');
    const companies = await get('http://localhost:3001/api/analytics/companies?batch=2023-2027');
    console.log(`Companies Results (Total Unique grouped items: ${companies.length}):`);
    console.log('  Top 5 Companies:');
    companies.slice(0, 5).forEach((c, idx) => {
      console.log(`    ${idx + 1}. ${c.company}: studentCount=${c.studentCount}, internshipCount=${c.internshipCount}, divisions=`, c.divisionBreakdown);
    });

    console.log('\nTesting /api/analytics/credits...');
    const credits = await get('http://localhost:3001/api/analytics/credits?batch=2023-2027');
    console.log('Credits Results:');
    console.log('  totalCreditsCalculated:', credits.totalCreditsCalculated);
    console.log('  averageCreditsPerStudent:', credits.averageCreditsPerStudent);
    console.log('  distribution:', credits.distribution);
    console.log(`  studentList (Total: ${credits.studentList.length}):`);
    const discrepancies = credits.studentList.filter(s => s.discrepancy !== 0);
    console.log(`  Discrepancy count (calculated vs sheet-reported): ${discrepancies.length}`);
    console.log('  Top 5 discrepancies:');
    discrepancies.slice(0, 5).forEach(s => {
      console.log(`    - ${s.name} (${s.prn}): calc=${s.totalCreditsCalculated}, sheet=${s.sheetReportedTotalCredits}, diff=${s.discrepancy}`);
    });

  } catch (err) {
    console.error('Error running verify script:', err);
  }
}

run();
