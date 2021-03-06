/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import Web3 from 'web3';
import { Container, Row, Card, Form, Col, Table, Button, Spinner, Modal } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';


import './App.css';
import { ERC20ABI } from './abis'
import { sendToken, sendBNB } from './web3-service';
import { sum } from './utils'

const networkURL = process.env.REACT_APP_NETWORK_URL;

function App() {
  const [tokenAddress, setTokenAddress] = useState();
  const [tokenName, setTokenName] = useState();
  const [tokenSymbol, setTokenSymbol] = useState();
  const [tokenDecimals, setTokenDecimals] = useState();
  const [tokenTotalSupply, setTokenTotalSupply] = useState();
  const [userAddress, setUserAddress] = useState();
  const [userTokenBalance, setUserTokenBalance] = useState();
  const [userBalance, setUserBalance] = useState();
  const [csvData, setCSVData] = useState([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultTxArray, setResultTxArray] = useState([]);
  const [resultError, setResultError] = useState();
  const [bnbChecked, setBNBChecked] = useState(false);

  /**
   * Get ERC-20 token information by token address
   * @param {*} address 
   * @returns 
   */
  const getTokenInfo = async (address) => {
    const tokenContract = new window.web3.eth.Contract(ERC20ABI, address);
    const decimals = await tokenContract.methods.decimals().call();
    const symbol = await tokenContract.methods.symbol().call();
    const name = await tokenContract.methods.name().call();
    const totalSupply = await tokenContract.methods.totalSupply().call();
    const balance = await tokenContract.methods.balanceOf(window.ethereum.selectedAddress).call();

    return {
      name, symbol, decimals, totalSupply, balance
    }
  }

  const updateTokenInfo = (tokenInfo) => {
    const { name, symbol, decimals, totalSupply } = tokenInfo;

    setTokenName(name);
    setTokenSymbol(symbol);
    setTokenDecimals(decimals);
    setTokenTotalSupply(totalSupply / Math.pow(10, decimals));

    updateUserWalletInfo(tokenInfo);
  }

  const updateUserWalletInfo = async (tokenInfo) => {
    const balance = await window.web3.eth.getBalance(window.ethereum.selectedAddress);

    setUserAddress(window.ethereum.selectedAddress);
    setUserBalance(balance / Math.pow(10, 18));

    if (tokenInfo) {
      setUserTokenBalance(tokenInfo.balance / Math.pow(10, tokenInfo.decimals));
    }
  }

  const connectWeb3 = async () => {
    if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider);
      try {
        // Request account access if needed
        await window.ethereum.request({ method: 'eth_requestAccounts' });

        updateUserWalletInfo();
        window.ethereum.on('accountsChanged', async (accounts) => {
          updateUserWalletInfo();
        })
      } catch (error) {
        console.error(error);
        return false;
      }
    } else {
      alert('install Metamsk')
    }
  }

  useEffect(() => {
    connectWeb3();
  }, []);
  

  let tokenAddressInputRef = undefined;
  const handleSelectToken = async () => {
    const address = tokenAddressInputRef.value;
    if (!window.web3.utils.isAddress(address)) {
      alert('Please input valid address');
      return;
    }

    setTokenAddress(address);

    const tokenInfo = await getTokenInfo(address);
    updateTokenInfo(tokenInfo);
  }

  const handleCheckBNB = (e) => {
    setBNBChecked(e.target.checked)
  }

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      if (typeof (FileReader) != "undefined") {
        const reader = new FileReader();

        const data = [];
        reader.onload = function (e) {
          const rows = e.target.result.split('\n');

          for (var i = 0; i < rows.length; i++) {
            if (rows[i]) {
              const cells = rows[i].split(',');
              if (cells.length > 1) {
                const address = cells[0].trim();
                const amount = parseFloat(cells[1].trim());
                if (window.web3.utils.isAddress(address)) data.push({ address, amount });
              }
            }
          }
          setCSVData(data);
          setSending(false);
          setSent(false);
        }

        reader.readAsText(files[0]);

      } else {
        alert("This browser does not support HTML5.");
      }
    }
  }

  const handleSend = async () => {
    if (!bnbChecked && !tokenAddress) return;

    setSending(true);
    try {
      const txArray = bnbChecked ? await sendBNB(csvData) : await sendToken(tokenAddress, userAddress, csvData);
      setSent(true);

      setResultTxArray(txArray);
    } catch (error) {
      setResultError(error.message);
    }

    let tokenInfo;
    if (tokenAddress) {
      tokenInfo = await getTokenInfo(tokenAddress);
    }
    updateUserWalletInfo(tokenInfo);
    setSending(false);
    setShowResultModal(true);
  }

  const handleModalClose = () => {
    setShowResultModal(false);
  }

  const totalAmount = csvData.length > 0 ? sum(csvData.map(d => d.amount)) : 0;

  return (
    <div className="App">
      <Container>
        <h3 className="p-2">2LC Token Multisender</h3>
        <Form className="m-2">
          <Form.Group as={Row}>
            <Form.Label column sm="2">
              Token Address:
            </Form.Label>
            <Col sm="4">
              <Form.Control ref={input => { tokenAddressInputRef = input; }} disabled={bnbChecked} />
            </Col>
            <Col sm="2">
              <Button onClick={handleSelectToken} disabled={bnbChecked}>Select</Button>
            </Col>
            <Col sm="2">
              <Form.Check type="checkbox" label="Send as BNB" checked={bnbChecked} onChange={handleCheckBNB} />
            </Col>
          </Form.Group>
        </Form>
        <Card>
          <Card.Header>Token information</Card.Header>
          <Card.Body>
            <Form>
              <Form.Group as={Row}>
                <Form.Label column sm="1">
                  Name:
                </Form.Label>
                <Col sm="2">
                  <Form.Control plaintext readOnly defaultValue={tokenName} />
                </Col>
                <Form.Label column sm="1">
                  Symbol:
                </Form.Label>
                <Col sm="2">
                  <Form.Control plaintext readOnly defaultValue={tokenSymbol} />
                </Col>
                <Form.Label column sm="1">
                  Decimals:
                </Form.Label>
                <Col sm="2">
                  <Form.Control plaintext readOnly defaultValue={tokenDecimals} />
                </Col>
              </Form.Group>
              <Form.Group as={Row}>
                <Form.Label column sm="1">
                  Address:
                </Form.Label>
                <Col sm="5" style={{ margin: 'auto' }}>
                  <a href={`${networkURL}/token/${tokenAddress}`} target="_blank" rel="noreferrer">{tokenAddress}</a>
                </Col>
                <Form.Label column sm="2">
                  Total Supply:
                </Form.Label>
                <Col sm="4">
                  <Form.Control plaintext readOnly defaultValue={tokenTotalSupply} />
                </Col>
              </Form.Group>
            </Form>
          </Card.Body>
        </Card>

        <Card className="mt-3">
          <Card.Header>Account information</Card.Header>
          <Card.Body>
            <Form>
              <Form.Group as={Row}>
                <Form.Label column sm="1">
                  Address:
                </Form.Label>
                <Col sm="5" style={{ margin: 'auto' }}>
                  <a href={`${networkURL}/address/${userAddress}`} target="_blank" rel="noreferrer">{userAddress}</a>
                </Col>
                <Form.Label column sm="1">
                  BNB:
                </Form.Label>
                <Col sm="2">
                  <Form.Control plaintext readOnly defaultValue={userBalance} />
                </Col>
                <Form.Label column sm="1">
                  {tokenSymbol}:
                </Form.Label>
                <Col sm="2">
                  <Form.Control plaintext readOnly defaultValue={userTokenBalance} />
                </Col>
              </Form.Group>
            </Form>
          </Card.Body>
        </Card>

        <Card className="mt-3">
          <Card.Header>Wallets information</Card.Header>
          <Card.Body>
            <Form.Group as={Row}>
              <Form.Label column sm="2">Select CSV file:</Form.Label>
              <Col sm="2">
                <Form.Control type="file" accept=".csv" onChange={handleFileChange} />
              </Col>
            </Form.Group>

            <Table striped bordered hover className="mt-4">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Address</th>
                  <th>Amount</th>
                  {/* <th className="text-center">Sent</th> */}
                </tr>
              </thead>
              <tbody>
                {
                  csvData.map((d, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><a href={`${networkURL}/address/${d.address}`} target="_blank" rel="noreferrer">{d.address}</a></td>
                      <td>{d.amount}</td>
                      {/* <td className="text-center">{d.sent && <i className="fa fa-check"></i>}</td> */}
                    </tr>
                  ))
                }
              </tbody>
            </Table>

            <div className="text-end">
              <span className="p-2">Total:&nbsp;<b>{totalAmount}</b></span>
              <Button variant="primary" disabled={(!tokenAddress && !bnbChecked) || csvData.length === 0 || sending} onClick={handleSend}>
                {
                  sending && (<div>
                    <Spinner
                      as="span"
                      animation="grow"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                    />&nbsp;
                    Sending...
                  </div>)
                }
                {!sending && 'Send'}
              </Button>
            </div>
          </Card.Body>
        </Card>

        <Modal size="lg" show={showResultModal} onHide={handleModalClose}>
          <Modal.Header closeButton>
            <Modal.Title>{resultError ? 'Error occurred' : 'Transaction list'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {resultError ? resultError : (
              resultTxArray.map((tx, i) => (
                <div key={tx.transactionHash}>
                  <a href={`${process.env.REACT_APP_NETWORK_URL}/tx/${tx.transactionHash}`} target="_blank" rel="noreferrer">{tx.transactionHash}</a>
                </div>
              ))
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleModalClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>

    </div>
  );
}

export default App;
