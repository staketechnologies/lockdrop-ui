/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react';
import { ApiPromise } from '@polkadot/api';
import * as plasmUtils from '../helpers/plasmUtils';
import { Claim, Lockdrop } from 'src/types/LockdropModels';
import {
    List,
    makeStyles,
    createStyles,
    ListSubheader,
    Divider,
    ListItem,
    Typography,
    ListItemText,
    ListItemIcon,
    Icon,
    ListItemSecondaryAction,
    IconButton,
    Tooltip,
    CircularProgress,
} from '@material-ui/core';
import plasmIcon from '../resources/plasm-icon.svg';
import Web3Utils from 'web3-utils';
import SendIcon from '@material-ui/icons/Send';
import CheckIcon from '@material-ui/icons/Check';
import { BN } from 'ethereumjs-util';
import { green } from '@material-ui/core/colors';
import BigNumber from 'bignumber.js';

interface Props {
    claimParams?: Lockdrop[];
    plasmApi: ApiPromise;
    networkType: 'ETH' | 'BTC';
}

const useStyles = makeStyles(theme =>
    createStyles({
        listRoot: {
            width: '100%',
            maxWidth: 'auto',
            backgroundColor: theme.palette.background.paper,
            position: 'relative',
            overflow: 'auto',
            height: 360,
            //minHeight: 360,
        },
        listSection: {
            backgroundColor: 'inherit',
        },
        ul: {
            backgroundColor: 'inherit',
            padding: 0,
        },
        lockListPage: {
            textAlign: 'center',
        },
        tabMenu: {
            backgroundColor: theme.palette.background.paper,
            width: 'auto',
        },
        inline: {
            display: 'inline',
        },
        iconProgress: {
            color: green[500],
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 1,
        },
    }),
);

const ClaimStatus: React.FC<Props> = ({ claimParams, plasmApi }) => {
    const classes = useStyles();
    return (
        <div>
            <Typography variant="h5" component="h2" align="center">
                PLM locked
            </Typography>
            <List className={classes.listRoot} subheader={<li />}>
                <li className={classes.listSection}>
                    <ul className={classes.ul}>
                        {claimParams ? (
                            <>
                                <ListSubheader>You can claim {claimParams.length} locks</ListSubheader>
                                <Divider />

                                {claimParams.map(e => (
                                    <>
                                        <ClaimItem key={e.transactionHash.toHex()} lockParam={e} plasmApi={plasmApi} />
                                    </>
                                ))}
                            </>
                        ) : (
                            <>
                                <ListSubheader>You don&apos;t have any locks!</ListSubheader>
                                <Divider />
                                <p>So much emptiness...</p>
                            </>
                        )}
                    </ul>
                </li>
            </List>
        </div>
    );
};

export default ClaimStatus;

interface ItemProps {
    lockParam: Lockdrop;
    plasmApi: ApiPromise;
}
const ClaimItem: React.FC<ItemProps> = ({ lockParam, plasmApi }) => {
    const classes = useStyles();
    const [claimData, setClaimData] = useState<Claim>();
    const [isSending, setSending] = useState(false);

    const claimId = plasmUtils.createLockParam(
        lockParam.type,
        lockParam.transactionHash.toHex(),
        lockParam.publicKey.toHex(),
        lockParam.duration.toString(),
        lockParam.value.toString(),
    ).hash;

    const truncateString = (str: string, num: number) => {
        if (str.length <= num) {
            return str;
        }
        // Return str truncated with '...' concatenated to the end of str.
        return str.slice(0, num) + '...';
    };

    const submitClaimReq = (param: Lockdrop) => {
        setSending(true);
        const _lock = plasmUtils.createLockParam(
            param.type,
            param.transactionHash.toHex(),
            param.publicKey.toHex(),
            param.duration.toString(),
            param.value.toString(),
        );
        const _nonce = plasmUtils.claimPowNonce(_lock.hash);
        // send lockdrop claim request
        plasmUtils // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .sendLockClaim(plasmApi, _lock as any, _nonce)
            .then(res => {
                console.log('Claim ID: ' + _lock.hash);
                console.log('Request transaction hash:\n' + res.toHex());
            });
    };

    useEffect(() => {
        plasmUtils.getClaimStatus(plasmApi, claimId).then(i => {
            setClaimData(i);
            // turn off loading if it's on
            if (isSending && i) setSending(false);
        });
    }, [claimId, plasmApi]);

    return (
        <>
            <ListItem>
                <ListItemIcon>
                    <Icon>
                        <img src={plasmIcon} alt="" />
                    </Icon>
                </ListItemIcon>
                <ListItemText>
                    <Typography component="h4" variant="h5" color="textPrimary">
                        Transaction Hash: {truncateString(lockParam.transactionHash.toHex(), 6)}
                    </Typography>
                    <Typography component="h5" variant="h6" className={classes.inline} color="textPrimary">
                        Locked {Web3Utils.fromWei(new BN(lockParam.value.toString(10)), 'ether')} ETH
                    </Typography>

                    {claimData && claimData.complete && (
                        <>
                            <br />
                            <Typography component="h5" variant="h6" className={classes.inline} color="textPrimary">
                                Receiving {plasmUtils.femtoToPlm(new BigNumber(claimData.amount.toString())).toFixed()}{' '}
                                PLD
                            </Typography>
                        </>
                    )}

                    <br />
                    <Typography component="p" variant="body2" className={classes.inline} color="textPrimary">
                        Claim ID: {claimId.toHex()}
                    </Typography>
                    <br />
                    <Typography
                        component="p"
                        variant="body2"
                        className={classes.inline}
                        color={claimData ? 'primary' : 'error'}
                    >
                        {claimData ? 'Claim requested' : 'Claim not requested'}
                    </Typography>
                    {claimData && (
                        <>
                            <br />
                            <Typography component="p" variant="body2" className={classes.inline} color="textPrimary">
                                Approval Votes: {claimData.approve.toString()}
                            </Typography>
                            <br />
                            <Typography component="p" variant="body2" className={classes.inline} color="textPrimary">
                                Decline Votes: {claimData.decline.toString()}
                            </Typography>
                        </>
                    )}
                </ListItemText>

                <ListItemSecondaryAction>
                    <div>
                        <Tooltip title="Send claim request">
                            <IconButton
                                edge="end"
                                aria-label="request"
                                onClick={() => submitClaimReq(lockParam)}
                                color="primary"
                            >
                                {claimData ? <CheckIcon /> : <SendIcon />}
                            </IconButton>
                        </Tooltip>
                        {isSending && <CircularProgress size={24} className={classes.iconProgress} />}
                    </div>
                </ListItemSecondaryAction>
            </ListItem>
            <Divider />
        </>
    );
};