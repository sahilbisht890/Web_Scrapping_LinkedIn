import puppeteer from 'puppeteer';
import XLSX from "xlsx";
import dotenv from 'dotenv';
dotenv.config({ path: '../loginDetails.env' });

let count = 0;
let objData = [];
let maxData = 400;
let skipData = 490;
let leftOverData = skipData % 10;

(async () => {


  //Inputs
  const searchFields = 'tourism';
  const country = 'Dubai';
  const industry = ['travel arrangements'];
  const companySizeId = ['#companySize-C', '#companySize-D', '#companySize-E'];
  const email = process.env.USER6;  
  const password = process.env.PASSWORD6;

  /*
      FOR THE COMAPNY SIZE USING ID : 

      ID >> companySize-B :  1-10 employees 
      ID >> companySize-C :  11-50 employees 
      ID >> companySize-D :  51-200 employees 
      ID >> companySize-E :  201-500 employees 
      ID >> companySize-F :  501-1000 employees 
      ID >> companySize-G :  1001-5000 employees 
      ID >> companySize-H :  5001-10,000 employees 
  */



  const browser = await puppeteer.launch({ headless: false, slowMo: 150 });

  //const context = await browser.createBrowserContext(); 

  const page = await browser.newPage();

  await page.goto('https://linkedin.com', {
    args: [
      '--incognito'
    ],
    timeout: 200000
  });

  await page.setViewport({ width: 1280, height: 1200 });

  //logging into  the linkedin account 

  await page.waitForSelector('#session_key');

  //await page.locator('button').wait() alternate for waitForSelector

  await page.type('#session_key', email);
  await page.waitForSelector('#session_password');
  await page.type('#session_password', password);
  await page.keyboard.press('Enter');

  await page.waitForNavigation();

  await page.waitForSelector('.search-global-typeahead__input');
  await page.type('.search-global-typeahead__input', searchFields);
  await page.keyboard.press('Enter');
  await page.waitForNavigation();

  await page.waitForSelector('.search-reusables__primary-filter');
  const btn = await page.$$('.search-reusables__primary-filter')
  let index = 0;

  //getting the company button  and clicking on it 

  for (let i in btn) {
    const textContent = await page.evaluate(element => element.textContent, btn[i]);
    if (textContent.trim() == 'Companies') {
      console.log(i);
      index = i;
      break;
    }
  }


  //clicking on the companies option 

  const companyBtn = await btn[index].$('button');
  await companyBtn.click();
  await page.waitForNavigation();

  //appling filter using the function filters for country and industry

  for(let val of industry)
    {
    console.log('value',val);
    await filtersTemp('#searchFilter_industryCompanyVertical', val, page);
  
    }
    await companySizeSelection(companySizeId, page);

  await filtersTemp('#searchFilter_companyHqGeo', country, page);

  if (skipData!= 0) {
    try {
      await Skips(skipData, page);
      console.log('jumped');
    } catch (error) {
      console.log(error);
    }
  }
  //for navigate to the next page and fetching the data from the each page
  while (true) {
    try {
   
      if (maxData == 0) break;      //breaking the loop when maxData is zero 

      //fetching the data 
      await dataFetch(page, browser);

      //checking if the next button is clickable or not 

      const nextBtn = await page.waitForSelector('button[aria-label="Next"]',{timeout:60000});
      let continueOrNot = await page.evaluate(element => element.disabled, nextBtn);

      console.log(continueOrNot);
      if (continueOrNot) break;   //if there is no next page exit the loop

      await nextBtn.click();
      await page.waitForNavigation();
    }
    catch (error) {
      console.log('no next button');
      break;
    }
  }

  console.log(objData);  //printing the data
      //converting the data into the excel file 
  toExcel(objData, 'dubai', 'tourism', '3rd');
  await browser.close();    //closing the browser

})();



//function to fetch the data from the page
async function dataFetch(page, browser) {
  let links = [];
  const dataContainer = await page.waitForSelector('.search-results-container');
  let listCard = await dataContainer.$$('.reusable-search__result-container');

  //fetching the link from the data and adding about/ to it so can directly navigate there 
  for (let i in listCard) {
    let val = listCard[i];
    let sizeOfData = await val.$$('div');
    if (sizeOfData.length > 1) {
      let anchor = await val.$('a');
      //storing the link in array

      const linkaddress = await page.evaluate(element => element.getAttribute('href'), anchor);

      links.push(linkaddress + 'about/');
    }
  };


  //fetching the data from each links 
  for (let i in links) {
    if (maxData == 0) break;

    //storing the fetch Data into val and storing it
    if (leftOverData > 0) {
      --leftOverData;
      continue;
    }

    let val = await fetchDataValue(links[i], browser);
    ++count;
    console.log("Total Iteration : ", count);
    if (Object.keys(val).length != 0) {
      objData.push(val);
      --maxData;
    }

  }
}

//function to fetch the value from the each link 

async function fetchDataValue(link, browser) {

  //opening the link into the new tab
  const page = await browser.newPage();

  await page.goto(link, {
    args: [
      '--incognito'
    ],
    timeout: 200000,
  });
  await page.setViewport({ width: 1280, height: 1024 });


  //Delay for around 2 seconds
  await delay(4000);

  const fetchingValues = await page.evaluate(() => {
    let tempData = {};
    try {
      console.log('fetchingValue');
      const datalist = document.querySelector('dl');
      if (datalist == null) return {};

      const companyname = document.querySelector('h1').innerText.trim();
      tempData['Company Name'] = companyname;

      const dt = Array.from(datalist.querySelectorAll('dt'));
      const dd = Array.from(datalist.querySelectorAll('dd'));

      //these fields value data we are fetching 
      const neededFields = ['Website', 'Industry', 'Company size', 'Headquarters', 'Phone', 'Founded'];
      let index = 0;

      dt.forEach((val) => {
        let dataFieldValue = val.innerText.trim();

        if (neededFields.includes(dataFieldValue)) {

          let dataValue = dd[index].innerText.trim();
          if (dataFieldValue == 'Phone')
            dataValue = dataValue.slice(0, dataValue.indexOf('P') - 1);

          tempData[dataFieldValue] = dataValue;

          if (dataFieldValue == 'Company size' && dt.length < dd.length)
            ++index;
        }
        ++index;

      });

    }
    catch (err) {
      return {};
    }

    console.log(tempData);
    return tempData;
  });

  await page.close();

  return fetchingValues;
}

//converting the data into the excel file 
function toExcel(data, country, searchFields, industry) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const filePath = `../ExcelData/${country}${searchFields}${industry}data.xlsx`
  XLSX.writeFile(wb, filePath);
}


//function for delay 
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}




async function filtersTemp(id, Input, page) {
  const locationFilter = await page.waitForSelector(id);
  await locationFilter.click();
  const divForm = await page.waitForSelector('div[visible]');
  
    const currentInput = await divForm.waitForSelector('input');
    // Typing into the input element
    await currentInput.type(Input,{delay:500});

    // Evaluating the input element within the context of the page
    let idLocationSuggestion = await page.evaluate(inputElement => {
      return inputElement.getAttribute('aria-controls');
    }, currentInput);

    idLocationSuggestion = '#' + idLocationSuggestion;
    await page.waitForSelector(idLocationSuggestion);
    const locationSuggestionElement = await page.$(idLocationSuggestion);

    const spans = await locationSuggestionElement.$$('.search-typeahead-v2__hit-text');
    let flag = true;

    //finding the value match from the options and clicking on it 
    for (let i in spans) {
      const valueInside = await page.evaluate(element => element.innerText.trim(), spans[i]);

      if (valueInside.toLowerCase() == Input) {
        await spans[i].click();
        flag = false;
        break;
      }

    }

    //if there is no match value ,clicking on the first options shown

    if (flag) {
      const firstSuggestionLocation = await locationSuggestionElement.$('.search-typeahead-v2__hit-text');
      await firstSuggestionLocation.click();

    }

  const showResult = await divForm.waitForSelector('button:nth-child(2)');
  await showResult.click();
}




async function Skips(skip, page) {

  if (skip <= 0) {
    console.log('no skip');
    return;

  };
  const temp = await page.waitForSelector('.search-results-container');
  const firstDiv = await temp.$('div:first-child');
  const total_result = await firstDiv.evaluate(element => parseInt(element.textContent.trim()));
  if (total_result <= skip) {
    console.log('everything is getting skipped');
    return;
  }
  console.log('total values contains', total_result);

  const pagesContainer = await page.waitForSelector(".artdeco-pagination__pages");
  let DataSkipNum = Math.floor(skip / 10) + 1;
  console.log('dataSkip', DataSkipNum);
  let previous = 0;
  let flag = true;

  while (flag) {
    const temp = await page.waitForSelector('.artdeco-pagination__pages');
    await page.waitForSelector('.artdeco-pagination__pages li');
    const liChild = await temp.$$('li');
    let find_max_index = liChild.length - 2;
    console.log(find_max_index);

    for (let index in liChild) {
      let valueInside = await page.evaluate(element => element.textContent.trim(), liChild[index]);
      console.log('valueInside', valueInside);

      if (valueInside == DataSkipNum) {
        await clickSkipNumber(index, page);
        console.log('clicked', valueInside);
        flag = false;
        break;
      }
      else if (valueInside == '…') {
        if (previous + 1 == DataSkipNum) {
          console.log('clicked ...', valueInside);
          await clickSkipNumber(index, page);
          flag = false;
          break;
        }
        else {
          console.log('...', find_max_index);
          find_max_index = index;
        }
      }
      previous = valueInside;
    }
    if (flag) await clickSkipNumber(find_max_index, page);

  }

}

async function clickSkipNumber(index, page) {

  const temp = await page.waitForSelector('.artdeco-pagination__pages');
  await page.waitForSelector('.artdeco-pagination__pages li');
  const liChild = await temp.$$('li');
  liChild[index].click();
  await page.waitForNavigation();
}

async function companySizeSelection(ids, page) {
  const companySize = await page.waitForSelector('#searchFilter_companySize');
  await companySize.click();
  const divForm = await page.waitForSelector('div[visible]');


  ids.forEach(async (val) => {
    const ch1 = await page.waitForSelector(val)
    ch1.click();
  })
  const showResult = await divForm.waitForSelector('button:nth-child(2)');
  await showResult.click();
}


